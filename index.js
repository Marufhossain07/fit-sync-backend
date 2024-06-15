const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000;
const app = express();


app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "https://fit-sync-f6689.web.app",
            "https://fit-sync-f6689.firebaseapp.com",
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
        const slotCollection = client.db('fitSync').collection('slots')
        const paymentCollection = client.db('fitSync').collection('payments')
        const forumCollection = client.db('fitSync').collection('forums')
        const reviewCollection = client.db('fitSync').collection('reviews')
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });

            res.send({ token })
        });

        // middlewares 
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next()
            })

        }

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const isAdmin = user?.role === 'admin'
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }
        const verifyTrainer = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const isTrainer = user?.role === 'trainer'
            if (!isTrainer) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }


        app.post('/subscribe', async (req, res) => {
            const data = req.body;
            const result = await subscribersCollection.insertOne(data);
            res.send(result);
        })

        app.get('/subscribe', verifyToken, verifyAdmin, async (req, res) => {
            const result = await subscribersCollection.find().toArray();
            res.send(result)
        })
        app.delete('/subscribe/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await subscribersCollection.deleteOne(query)
            res.send(result)
        })

        app.post('/add-class', verifyToken, verifyAdmin, async (req, res) => {
            const data = req.body;
            const result = await classesCollection.insertOne(data);
            res.send(result)
        })
        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find().toArray()
            res.send(result)
        })
        app.get('/trainers/classes/:skills', async(req,res)=>{
            const skills = req.params.skills;
            const skill = skills.split(',')
            const query = {name: {$in: skill}}
            const result = await classesCollection.find(query).toArray();
            res.send(result);
        })

        app.get('/all-classes', async (req, res) => {
            const page = parseInt(req.query.page) - 1
            const size = parseInt(req.query.size)
            const search = req.query.search;
            const query = {
                name: { $regex: search, $options: 'i' }
            }
            const result = await classesCollection.find(query).skip(page * size).limit(size).toArray()
            res.send(result)
        })
        app.get('/all-forums', async (req, res) => {
            const page = parseInt(req.query.page) - 1
            const size = parseInt(req.query.size)
            const result = await forumCollection.find().skip(page * size).limit(size).toArray()
            res.send(result)
        })

        app.get('/classes-count', async (req, res) => {
            const result = await classesCollection.countDocuments()
            res.send({ result })
        })
        app.get('/top-classes', async(req,res)=>{
            const option = {
                $sort: {
                    bookedCount: -1
                }
            }
            const result = await classesCollection.aggregate([option]).toArray();
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

        app.patch('/user', verifyToken, async (req, res) => {
            const newData = req.body;
            const filter = { email: newData.email }

            const updatedDoc = {
                $set: {
                    name: newData.name,
                }
            }
            const trainerResult = await trainersCollection.updateOne(filter, updatedDoc)
            const result = await usersCollection.updateOne(filter, updatedDoc);
            res.send(result)
        })

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            let admin = false;
            if (user) {
                admin = user?.role === 'admin'
            }
            res.send({ admin })
        })
        app.get('/from-users/trainer/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            let trainer = false;
            if (user) {
                trainer = user?.role === 'trainer'
            }
            res.send({ trainer })
        })
        app.get('/user/role/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await usersCollection.findOne(query);
            res.send(result)
        })

        app.post('/trainer', async (req, res) => {
            const newTrainer = req.body;
            const query = { email: newTrainer.email }
            const isExist = await trainersCollection.findOne(query);
            if (isExist) {
                if (isExist.status === 'pending') {
                    return res.send({ message: "You have already applied" })
                }
                if (isExist.status === 'accepted') {
                    return res.send({ message: "You are already a Trainer" })
                }
            }

            const result = await trainersCollection.insertOne(newTrainer);
            res.send(result)
        })

        app.put('/trainer/feedback', verifyToken, verifyAdmin, async (req, res) => {
            const info = req.body
            const filter = { _id: new ObjectId(info.id) }
            const updatedDoc = {
                $set: {
                    feedback: info.feedback,
                    status: 'rejected'
                }
            }
            const result = await trainersCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })
        app.get('/all-trainer', async (req, res) => {

            const query = { status: 'accepted' }
            const result = await trainersCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/trainer', async (req, res) => {

            const query = { status: 'accepted' }
            const result = await trainersCollection.find(query).toArray()
            res.send(result)
        })
        app.get('/trainer/:name', async (req, res) => {
            const className = req.params.name;
            const query = { skills: { $in: [className] } }
            const result = await trainersCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/trainer/feedback/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await trainersCollection.findOne(query);
            res.send(result)
        })

        app.get('/trainer/details/:email', async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const result = await trainersCollection.findOne(query);
            res.send(result)
        })

        app.get('/trainer/booked/:email',  async(req,res)=>{
            const email = req.params.email;
            const query = {bookedBy: email};
            const result = await slotCollection.find(query).toArray();
            res.send(result)
        })


        app.delete('/trainer', verifyToken, verifyAdmin,  async (req, res) => {
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


        app.get('/applied', verifyToken, verifyAdmin, async (req, res) => {
            const query = { status: 'pending' }
            const result = await trainersCollection.find(query).toArray();
            res.send(result)
        })
        app.get('/activity-log', async (req, res) => {
            const query = { status: { $in: ['pending', 'rejected'] } }
            const result = await trainersCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/applied/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await trainersCollection.findOne(query);
            res.send(result);
        })
        app.patch('/applied/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
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
            const roleResult = await usersCollection.updateOne(filter, updatedRole)
            const result = await trainersCollection.updateOne(filter, updatedDoc)
            res.send({ result, roleResult })
        })

        app.post('/slot', verifyToken, verifyTrainer, async (req, res) => {
            const slot = req.body;
            const filter = { email: slot.email }
            const updatedDoc = {
                $inc: {
                    availableSlots: 1
                }
            }
            const trainerResult = await trainersCollection.updateOne(filter, updatedDoc)
            const result = await slotCollection.insertOne(slot)
            res.send(result)
        })

        // booked and payment slot
        app.get('/book-slot/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await slotCollection.findOne(query)
            res.send(result)
        })

        // booking page slot
        app.get('/booking/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await slotCollection.findOne(query)
            res.send(result)
        })

        // manage slots dashboard
        app.get('/slot/:email', verifyToken, verifyTrainer,  async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await slotCollection.find(query).toArray();
            res.send(result)
        })

        // trainer details page slots
        app.get('/available-slots/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email, bookedBy: 'none' }
            const result = await slotCollection.find(query).toArray();
            res.send(result)
        })

        app.delete('/slot/:id/:email', verifyToken, verifyTrainer, async (req, res) => {
            const id = req.params.id;
            const email = req.params.email;
            const filter = { email: email }
            const updatedDoc = {
                $inc: {
                    availableSlots: -1
                }
            }
            const trainerResult = await trainersCollection.updateOne(filter, updatedDoc)
            const query = { _id: new ObjectId(id) }
            const result = await slotCollection.deleteOne(query)
            res.send(result)
        })

        app.post('/payment', verifyToken, async (req, res) => {
            const newPayment = req.body;
            const filter = { _id: new ObjectId(newPayment.slotId) }
            const updatedSlot = {
                $set: {
                    bookedBy: newPayment.email
                }
            }
            const slotResult = await slotCollection.updateOne(filter, updatedSlot);

            const filterClass = { name: { $in: newPayment.classes } }
            const updatedClass = {
                $inc: {
                    bookedCount: 1
                }
            }

            const filterTrainer = { email: newPayment.trainerEmail }
            const updatedTrainer = {
                $inc: {
                    availableSlots: -1
                }
            }
            const trainerResult = await trainersCollection.updateOne(filterTrainer, updatedTrainer)
            const classesResult = await classesCollection.updateMany(filterClass, updatedClass)
            const result = await paymentCollection.insertOne(newPayment);
            res.send(result)
        })

        app.post('/forum', verifyToken, async(req,res)=>{
            const data = req.body;
            const result = await forumCollection.insertOne(data);
            res.send(result)
        })

        app.get('/forum', async(req,res)=>{
            const result = await forumCollection.find().toArray();
            res.send(result)
        })

        app.patch('/forum/upvote/:id', async(req,res)=>{
            const id = req.params.id;
            const filter = {_id: new ObjectId(id)}
            const updatedDoc = {
                $inc:{
                    upvote : 1
                }
            }

            const result = await forumCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })
        app.patch('/forum/downvote/:id', async(req,res)=>{
            const id = req.params.id;
            const filter = {_id: new ObjectId(id)}
            const updatedDoc = {
                $inc:{
                    upvote : -1
                }
            }

            const result = await forumCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        app.get('/forums-count', async(req,res)=>{
            const result = await forumCollection.countDocuments()
            res.send({result})
        })

        app.post('/review', async(req,res)=>{
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result)
        })

        app.get('/review', async(req,res)=>{
            const result = await reviewCollection.find().toArray();
            res.send(result)
        })

        app.get('/balance/stats', verifyToken, verifyAdmin, async(req,res)=>{
            const filter = {status: 'accepted'}
            const trainers = await trainersCollection.countDocuments(filter)
            const memberFilter = {role: 'member'}
            const members = await usersCollection.countDocuments(memberFilter)
            const classes = await classesCollection.estimatedDocumentCount();
            const paid = await paymentCollection.estimatedDocumentCount()
            const subscribers = await subscribersCollection.estimatedDocumentCount()
            const transaction = await paymentCollection.find().sort({time: -1}).toArray()
            const result = await paymentCollection.aggregate([
                {
                    $group:{
                        _id: null,
                        total: {
                            $sum: '$price'
                        }
                    }
                }
            ]).toArray()

            const balance = result.length > 0 ? result[0].total : 0;
            res.send({
                trainers,
                members,
                classes,
                balance,
                transaction,
                paid,
                subscribers
            }) 
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