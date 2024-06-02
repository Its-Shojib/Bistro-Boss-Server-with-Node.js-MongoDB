const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const app = express()
const port = process.env.PORT || 5000
require('dotenv').config()
let cors = require('cors')
let cookieParser = require('cookie-parser')
let jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://bistro-boss-restaurants-44ed2.firebaseapp.com',
    'https://bistro-boss-restaurants-44ed2.web.app'
  ],
  credentials: true
}))
app.use(express.json());
app.use(cookieParser());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oglq0ui.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    const menuCollections = client.db("Bistro-Boss-Restaurant").collection('Menu');
    const reviewCollections = client.db("Bistro-Boss-Restaurant").collection('Reviews');
    const cartCollections = client.db("Bistro-Boss-Restaurant").collection('Carts');
    const userCollections = client.db("Bistro-Boss-Restaurant").collection('Users');
    const paymentCollections = client.db("Bistro-Boss-Restaurant").collection('Payments');
    const payInfoCollections = client.db("Bistro-Boss-Restaurant").collection('PayInfo');
    const retRequestCollections = client.db("Bistro-Boss-Restaurant").collection('RetRequest');



    // middlewares verify token
    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_PASS, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollections.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }


    //jwt related api
    app.post('/jwt', async (req, res) => {
      let user = req.body;
      let token = jwt.sign(user, process.env.ACCESS_TOKEN_PASS, { expiresIn: '1h' });
      res.send({ token })
    })

    // User Related API
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      let result = await userCollections.find().toArray();
      res.send(result)
    })

    //for google sign-in
    app.post('/users', async (req, res) => {
      let newUser = req.body;
      let query = { email: newUser.email };
      let existingUser = await userCollections.findOne(query);
      if (existingUser) {
        return res.send({ message: 'User already exist', insertedId: null });
      }
      let result = await userCollections.insertOne(newUser);
      res.send(result)
    })

    //delete an user
    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      let id = req.params.id;
      let query = { _id: new ObjectId(id) };
      let result = await userCollections.deleteOne(query);
      res.send(result)
    })
    //update the user role
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      let id = req.params.id;
      let query = { _id: new ObjectId(id) };
      let updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      let result = await userCollections.updateOne(query, updatedDoc);
      res.send(result)
    })

    //check admin or not
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      let userEmail = req.params.email;
      if (userEmail !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidded access' })
      }
      let query = { email: userEmail };
      let user = await userCollections.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin'
      }
      res.send({ admin });
    });

    /*Menu Food item */
    app.get('/menu', async (req, res) => {
      let result = await menuCollections.find().toArray();
      res.send(result);
    })

    //find one menu item
    app.get('/menu/:id', async (req, res) => {
      let id = req.params.id;
      let query = { _id: new ObjectId(id) };
      let result = await menuCollections.findOne(query)
      res.send(result);
    })

    //add a menu item
    app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
      let menuItem = req.body;
      let result = await menuCollections.insertOne(menuItem);
      res.send(result);
    })

    //delete a menu item
    app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      let id = req.params.id;
      let query = { _id: new ObjectId(id) };

      let result = await menuCollections.deleteOne(query);
      if (!result.deletedCount) {
        result = await menuCollections.deleteOne({ _id: id });
      }
      res.send(result);
    })

    //update a menu item
    app.patch('/menu/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image
        }
      }
      const result = await menuCollections.updateOne(filter, updatedDoc)
      res.send(result);
    })


    //user review
    app.get('/review', async (req, res) => {
      let result = await reviewCollections.find().toArray();
      res.send(result);
    })

    /*Cart section*/
    //add to cart
    app.post('/carts', async (req, res) => {
      let newFood = req.body;
      let result = await cartCollections.insertOne(newFood);
      res.send(result);
    });

    //load the cart item
    app.get('/carts', async (req, res) => {
      let email = req.query.email;
      let query = { email: email };
      let result = await cartCollections.find(query).toArray();
      res.send(result);
    })

    //delete one cart item
    app.delete('/carts/:id', async (req, res) => {
      let id = req.params.id;
      let query = { _id: new ObjectId(id) };
      let result = await cartCollections.deleteOne(query);
      res.send(result);
    });

    app.get('/cart/item/:id', async (req, res) => {
      let id = req.params.id;
      let query = { _id: new ObjectId(id) };
      let result = await menuCollections.findOne(query);
      res.send(result);
    });

    app.post('/add/payinfo', async (req, res) => {
      let newPayInfo = req.body;
      let result = await payInfoCollections.insertOne(newPayInfo);
      console.log(result)
      res.json({
        result: true,
      });
    });

    app.get('/payinfo/:email', async (req, res) => {
      let email = req.params.email;
      let query = { email: email };
      let result = await payInfoCollections.findOne(query);
      res.send(result);
    })


    //Payment related Api
    //create payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      let amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //load data for payment history
    app.get('/payments/:email', verifyToken, async (req, res) => {
      let email = req.params.email;
      let query = { email: email };

      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidded access' })
      }
      let result = await paymentCollections.find(query).toArray();
      res.send(result);
    })

    //post payment data into database
    //delete item from cart collection
    app.post('/payment', async (req, res) => {
      let payment = req.body;
      let id = payment.itemId;
      let menuQuery = { _id: new ObjectId(id) };
      let menuItem = await menuCollections.findOne(menuQuery);
      let product = menuItem.totalProduct;
      let updatedDocuments = {
        $set: {
          totalProduct: product - (payment.quantity + payment.freeItems)
        }
      }
      let menuResult = await menuCollections.updateOne(menuQuery, updatedDocuments);
      if (menuResult.modifiedCount > 0) {
        let paymentResult = await paymentCollections.insertOne(payment);
        let query = { email: payment.email };
        let deleteResult = await payInfoCollections.deleteOne(query);
        res.json({
          result: true,
          paymentResult: paymentResult,
          deleteResult: deleteResult
        });
      }

    })

    //Admin Stat
    app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
      let users = await userCollections.estimatedDocumentCount();
      let menuItems = await menuCollections.estimatedDocumentCount();
      let orders = await paymentCollections.estimatedDocumentCount();

      //Bangla-way
      // let payments = await paymentCollections.find().toArray();
      // let totalPrice = payments.reduce((total,item)=> total + item.price, 0)

      //English-Way
      let result = await paymentCollections.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: '$price'
            }
          }
        }
      ]).toArray();

      let revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({
        users,
        menuItems,
        orders,
        // totalPrice,
        revenue
      })
    })

    //Order-stats
    app.get('/order-stats', verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentCollections.aggregate([
        {
          $unwind: '$menuItemIds'
        },
        {
          $lookup: {
            from: 'Menu',
            localField: 'menuItemIds',
            foreignField: '_id',
            as: 'menuItems'
          }
        },
        {
          $unwind: '$menuItems'
        },
        {
          $group: {
            _id: '$menuItems.category',
            quantity: { $sum: 1 },
            revenue: { $sum: '$menuItems.price' }
          }
        },
        {
          $project: {
            _id: 0,
            category: '$_id',
            quantity: '$quantity',
            revenue: '$revenue'
          }
        }
      ]).toArray();

      res.send(result);

    });


    app.put('/add-offer', async (req, res) => {
      let offer = req.body;
      let count = 0;
      let menus = await menuCollections.find().toArray();
      let options = { upsert: true };
      if (offer.globalOffer == 'all') {
        if (offer.offerType == 'buyOffer') {
          updatedDoc = {
            $set: {
              offerType: offer.offerType,
              buyAmount: parseInt(offer.buyAmount),
              getFreeAmount: parseInt(offer.getFreeAmount),
              offer: 0,
            }
          }
          let result = await menuCollections.updateMany({}, updatedDoc, options);
          if (result.modifiedCount > 0) {
            count++;
          }
        } else if (offer.offerType === 'percentage') {
          for (let i = 0; i < menus.length; i++) {
            let id = menus[i]._id;
            let query = { _id: new ObjectId(id) }
            let price = menus[i].price;
            let off = price - (price * parseInt(offer.buyAmount) / 100);
            updatedDocument = {
              $set: {
                offerType: offer.offerType,
                buyAmount: parseInt(offer.buyAmount),
                getFreeAmount: 0,
                offer: off,
              }
            }
            let result = await menuCollections.updateOne(query, updatedDocument, options);
            if (result.modifiedCount > 0) {
              count++;
            }
          }
        }
      } else if (offer.globalOffer == 'specific') {
        let query = { category: offer.foodType };
        if (offer.offerType == 'buyOffer') {
          updatedDoc = {
            $set: {
              offerType: offer.offerType,
              buyAmount: parseInt(offer.buyAmount),
              getFreeAmount: parseInt(offer.getFreeAmount),
              offer: 0,
            }
          }
          let result = await menuCollections.updateMany(query, updatedDoc, options);
          if (result.modifiedCount > 0) {
            count++;
          }
        } else if (offer.offerType === 'percentage') {
          let items = menus.filter(item => offer.foodType === item.category);
          console.log(items);
          for (let i = 0; i < items.length; i++) {
            let id = items[i]._id;
            let query = { _id: new ObjectId(id) }
            let price = items[i].price;
            let off = price - (price * parseInt(offer.buyAmount) / 100);
            updatedDocument = {
              $set: {
                offerType: offer.offerType,
                buyAmount: parseInt(offer.buyAmount),
                getFreeAmount: 0,
                offer: off,
              }
            }
            let result = await menuCollections.updateOne(query, updatedDocument, options);
            if (result.modifiedCount > 0) {
              count++;
            }
          }
        }

      } else if (offer.globalOffer == 'single') {
        let id = offer.specificItem;
        let query = { _id: new ObjectId(id) }
        if (offer.offerType == 'buyOffer') {
          updatedDoc = {
            $set: {
              offerType: offer.offerType,
              buyAmount: parseInt(offer.buyAmount),
              getFreeAmount: parseInt(offer.getFreeAmount),
              offer: 0,
            }
          }
          let result = await menuCollections.updateOne(query, updatedDoc, options);
          if (result.modifiedCount > 0) {
            count++;
          }
        } else if (offer.offerType === 'percentage') {
          let id = offer.specificItem;
          let query = { _id: new ObjectId(id) }
          let item = await menuCollections.findOne(query)
          let price = item.price;
          let off = price - (price * parseInt(offer.buyAmount) / 100);
          updatedDocument = {
            $set: {
              offerType: offer.offerType,
              buyAmount: parseInt(offer.buyAmount),
              getFreeAmount: 0,
              offer: off,
            }
          }
          let result = await menuCollections.updateOne(query, updatedDocument, options);
          if (result.modifiedCount > 0) {
            count++;
          }
        }
      }
      if (count !== 0) {
        res.json({
          result: true,
          message: 'Offer added successfully',
        })
      } else {
        res.json({
          result: false,
          message: 'Something went wrong',
        })
      }
    });

    app.post('/returned-request', async (req, res) => {
      let request = req.body;
      let result = await retRequestCollections.insertOne(request);
      console.log(result)
      if (result.insertedId) {
        res.json({
          result: true,
          message: 'Request sent successfully',
        })
      } else {
        res.json({
          result: false,
          message: 'Something went wrong',
        })
      }
    });

    app.get('/get-return-request', async (req, res) => {
      let result = await retRequestCollections.find().toArray();
      res.send(result);
    });

    app.put('/returned-confirm', async (req, res) => {
      let product = req.body;
      let id = product.payment._id;
      let menuQuery = { _id: new ObjectId(product.payment.itemId) };
      let menuItem = await menuCollections.findOne(menuQuery);
      let totalP = menuItem.totalProduct;
      let options = { upsert: true };
      let count = 0;
      let query = { _id: new ObjectId(id) };
      if (product.payment.offerType == 'percentage') {
        let returnedPrice = (product.payment.price / product.payment.quantity) * (product.requestedAmount);
        let returnedProduct = parseInt(product.requestedAmount);

        let updatedPaymentDoc = {
          $set: {
            itemReturned: returnedProduct,
            priceBack: parseFloat(returnedPrice.toFixed(2)),
            returned: true,
          }
        }
        let result = await paymentCollections.updateOne(query, updatedPaymentDoc, options);
        let updatedMenuDoc = {
          $set: {
            totalProduct: totalP + returnedProduct,
          }
        }
        let menuResult = await menuCollections.updateOne(menuQuery, updatedMenuDoc);
        if (result.modifiedCount > 0 && menuResult.modifiedCount > 0) {
          count++;
        }
        let Retquery = { _id: new ObjectId(product._id) };
        let updatedReturnedDoc = {
          $set: {
            itemReturned: returnedProduct,
            priceBack: parseFloat(returnedPrice.toFixed(2)),
            returned: true,
          }
        }
        let result2 = await retRequestCollections.updateOne(Retquery, updatedReturnedDoc, options);
        if (result2.modifiedCount > 0) {
          count++;
        }
        if (count == 2) {
          res.json({
            result: true,
            message: 'Request confirmed',
          })
        } else {
          res.json({
            result: false,
            message: 'Something went wrong',
          })
        }
      } else {
        let returnedPrice = (product.payment.price / product.payment.quantity) * (product.requestedAmount);

        let freeItemReturn = product.payment.freeItems - Math.floor((product.payment.quantity - product.requestedAmount) / product.payment.buyAmount) * product.payment.getFreeAmount;
        let returnedProduct = parseInt(product.requestedAmount + freeItemReturn);

        let updatedPaymentDoc = {
          $set: {
            itemReturned: returnedProduct,
            priceBack: parseFloat(returnedPrice.toFixed(2)),
            returned: true,
          }
        }
        let result = await paymentCollections.updateOne(query, updatedPaymentDoc, options);
        let updatedMenuDoc = {
          $set: {
            totalProduct: totalP + returnedProduct,
          }
        }
        let menuResult = await menuCollections.updateOne(menuQuery, updatedMenuDoc);
        if (result.modifiedCount > 0 || menuResult.modifiedCount > 0) {
          count++;
        }
        let Retquery = { _id: new ObjectId(product._id) };
        let updatedReturnedDoc = {
          $set: {
            itemReturned: returnedProduct,
            priceBack: parseFloat(returnedPrice.toFixed(2)),
            returned: true,
          }
        }
        let result2 = await retRequestCollections.updateOne(Retquery, updatedReturnedDoc, options);
        if (result2.modifiedCount > 0) {
          count++;
        }
        if (count == 2) {
          res.json({
            result: true,
            message: 'Request confirmed',
          })
        } else {
          res.json({
            result: false,
            message: 'Something went wrong',
          })
        }
      }
    });

    app.get('/product-status', async (req, res) => {
      let payment = await paymentCollections.find().toArray();
      let returned = await retRequestCollections.find({ returned: true }).toArray();
      res.json({
        payment: payment,
        returned: returned,
      })
    });



    // await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Bistrooo Bossss is Running!')
})

app.listen(port, () => {
  console.log(`Bistro Boss is listening on port ${port}`)
})