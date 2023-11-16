const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const app = express()
const port = process.env.PORT || 5000
require('dotenv').config()
let cors = require('cors')
let cookieParser = require('cookie-parser')
let jwt = require('jsonwebtoken');


app.use(cors({
  origin: 'http://localhost:5173',
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
    app.get('/users', verifyToken,verifyAdmin, async (req, res) => {
      let result = await userCollections.find().toArray();
      res.send(result)
    })

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

    app.delete('/users/:id',verifyToken,verifyAdmin, async (req, res) => {
      let id = req.params.id;
      let query = { _id: new ObjectId(id) };
      let result = await userCollections.deleteOne(query);
      res.send(result)
    })
    app.patch('/users/admin/:id',verifyToken,verifyAdmin, async (req, res) => {
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
    })



    /*Food item */
    app.get('/menu', async (req, res) => {
      let result = await menuCollections.find().toArray();
      res.send(result);
    })
    app.get('/review', async (req, res) => {
      let result = await reviewCollections.find().toArray();
      res.send(result);
    })

    /*Cart section*/
    app.post('/carts', async (req, res) => {
      let newFood = req.body;
      let result = await cartCollections.insertOne(newFood);
      res.send(result);
    });

    app.get('/carts', async (req, res) => {
      let email = req.query.email;
      let query = { email: email };
      let result = await cartCollections.find(query).toArray();
      res.send(result);
    })
    app.delete('/carts/:id', async (req, res) => {
      let id = req.params.id;
      let query = { _id: new ObjectId(id) };
      let result = await cartCollections.deleteOne(query);
      res.send(result);
    })





    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
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