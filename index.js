const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express')
const app = express()
const port = process.env.PORT || 5000
require('dotenv').config()
let cors = require('cors')

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}))
app.use(express.json())

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

    app.get('/carts', async(req,res)=>{
      let email = req.query.email;
      let query = {email : email};
      let result = await cartCollections.find(query).toArray();
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