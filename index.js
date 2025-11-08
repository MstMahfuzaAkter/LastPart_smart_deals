const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require('firebase-admin');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const decoded = Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Firebase token verify middleware
const verifyFirebaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: 'unauthorized access' });
  }
  const token = authorization.split(' ')[1];
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.token_email = decoded.email;
    next();
  } catch {
    return res.status(401).send({ message: 'unauthorized access' });
  }
};

const uri = `mongodb+srv://smartdbuser:${process.env.SECRET_YKE}@cluster0.ruwopzq.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get('/', (req, res) => {
  res.send('Smart server is running');
});

async function run() {
  try {
    await client.connect();
    const db = client.db('smartdbuser');
    const productsCollection = db.collection('products');
    const bidsCollection = db.collection('bids');
    const usersCollection = db.collection('users');

    // USERS APIs
    app.post('/users', async (req, res) => {
      const newUser = req.body;
      const email = req.body.email;
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        res.send({ message: 'user already exists' });
      } else {
        const result = await usersCollection.insertOne(newUser);
        res.send(result);
      }
    });

    // PRODUCTS APIs
    app.get('/products', async (req, res) => {
      const email = req.query.email;
      const query = email ? { email } : {};
      const result = await db.collection('products').find(query).toArray();
      res.send(result);
    });

    app.get('/latest-products', async (req, res) => {
      const result = await productsCollection.find().sort({ created_at: -1 }).limit(6).toArray();
      res.send(result);
    });

    app.get('/products/:id', async (req, res) => {
      const id = req.params.id;
      const result = await productsCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.post('/products', verifyFirebaseToken, async (req, res) => {
      const newProduct = req.body;
      const result = await productsCollection.insertOne(newProduct);
      res.send(result);
    });

    app.patch('/products/:id', async (req, res) => {
      const id = req.params.id;
      const update = {
        $set: {
          name: req.body.name,
          price: req.body.price
        }
      };
      const result = await productsCollection.updateOne({ _id: new ObjectId(id) }, update);
      res.send(result);
    });

    app.delete('/products/:id', async (req, res) => {
      const id = req.params.id;
      const result = await productsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // BIDS APIs
    app.get('/bids', async (req, res) => {
      const email = req.query.email;
      const query = email ? { buyer_email: email } : {};
      const result = await bidsCollection.find(query).toArray();
      res.send(result);
    });

    app.post('/bids', async (req, res) => {
      const newBid = req.body;
      const result = await bidsCollection.insertOne(newBid);
      res.send(result);
    });

    app.delete('/bids/:id', async (req, res) => {
      const id = req.params.id;
      const result = await bidsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    console.log("Connected to MongoDB successfully!");
  } catch (err) {
    console.error(err);
  }
}
run().catch(console.dir);

// ❌ app.listen বাদ দাও
// ✅ Vercel এর জন্য app export করো
module.exports = app;
