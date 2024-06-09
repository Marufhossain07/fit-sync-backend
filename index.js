const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000;
const app = express();


app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "https://cardoctor-bd.web.app",
            "https://cardoctor-bd.firebaseapp.com",
        ]
    })
);
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vo0jwvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const subscribersCollection = client.db('fitSync').collection('subscribers')
        const classesCollection = client.db('fitSync').collection('classes')
        const usersCollection = client.db('fitSync').collection('users')
        const trainersCollection = client.db('fitSync').collection('trainers')
        app.post('/subscribe', async (req, res) => {
            const data = req.body;
            const result = await subscribersCollection.insertOne(data);
            res.send(result);
        })

        app.get('/subscribe', async (req, res) => {
            const result = await subscribersCollection.find().toArray();
            res.send(result)
        })
        app.delete('/subscribe/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await subscribersCollection.deleteOne(query)
            res.send(result)
        })

        app.post('/add-class', async (req, res) => {
            const data = req.body;
            const result = await classesCollection.insertOne(data);
            res.send(result)
        })
        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find().toArray()
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const newUser = req.body;
            const query = { email: newUser.email }
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                const updatedDoc = {
                    $set: {
                        lastLogin: newUser.lastLogin
                    }
                }
                const result = await usersCollection.updateOne(query, updatedDoc)
                return res.send({ message: 'user already exists', result })
            }
            const result = await usersCollection.insertOne(newUser);
            res.send(result)
        })

        app.post('/trainer', async (req, res) => {
            const newTrainer = req.body;
            const result = await trainersCollection.insertOne(newTrainer);
            res.send(result)
        })

        app.get('/trainer', async (req, res) => {
            const query = {status: 'accepted'}
            const result = await trainersCollection.find(query).toArray()
            res.send(result)
        })


        app.delete('/trainer', async (req, res) => {
            const id = req.query.id
            const email = req.query.email
            const query = { _id: new ObjectId(id) }
            const filter = { email: email }
            const updatedDoc = {
                $set: {
                    role: 'member'
                }
            }
            const updatedResult = await usersCollection.updateOne(filter, updatedDoc)
            const result = await trainersCollection.deleteOne(query)
            res.send({ result, updatedResult })
        })


        app.get('/applied', async (req, res) => {
            const query = { status: 'pending' }
            const result = await trainersCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/applied/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await trainersCollection.findOne(query);
            res.send(result);
        })
        app.patch('/applied/:email', async(req,res)=>{
            const email = req.params.email;
            const filter = {email: email}
            const updatedDoc = {
                $set: {
                    status: 'accepted'
                }
            }
            const updatedRole = {
                $set: {
                    role: 'trainer'
                }
            }
            const roleResult = await usersCollection.updateOne(filter,updatedRole)
            const result = await trainersCollection.updateOne(filter,updatedDoc)
            res.send({result,roleResult})
        })
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
    res.send('server is running very high')
})

app.listen(port, () => {
    console.log('the server is running man');
})