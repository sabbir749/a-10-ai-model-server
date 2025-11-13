const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
require("dotenv").config();
require("dotenv").config();
const serviceAccount = require("./serviceKey.json");
const app = express();
const port = 3000;
app.use(cors());
app.use(express.json());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.r0jfqoe.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({
      message: "unauthorized access. Token not found!",
    });
  }

  const token = authorization.split(" ")[1];
  try {
    await admin.auth().verifyIdToken(token);

    next();
  } catch (error) {
    res.status(401).send({
      message: "unauthorized access.",
    });
  }
};

async function run() {
  try {
    // await client.connect();

    const db = client.db("model-db");
    const modelCollection = db.collection("models");
    const downloadCollection = db.collection("downloads");

    // find
    // findOne

    app.get("/models", async (req, res) => {
      const result = await modelCollection.find().toArray();
      res.send(result);
    });

    app.get("/models/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      // const objectId = new ObjectId(id);
      // console.log(objectId);

      const result = await modelCollection.findOne({ _id: new ObjectId(id) });
      console.log(result);

      res.send({
        success: true,
        result,
      });
    });

    // post method
    //  insertOne
    //  insertMany

    app.post("/models", async (req, res) => {
      const data = req.body;
      // console.log(data)
      const result = await modelCollection.insertOne(data);
      res.send({
        success: true,
        result,
      });
    });

    //PUT
    //updateOne
    //updateMany

    app.put("/models/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const data = req.body;

      try {
        const objectId = new ObjectId(id);

        // Get decoded token to know who is logged in
        const token = req.headers.authorization.split(" ")[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userEmail = decodedToken.email;

        // Find the model
        const model = await modelCollection.findOne({ _id: objectId });
        if (!model) {
          return res.status(404).send({ message: "Model not found" });
        }

        // Only creator can update
        if (model.createdBy !== userEmail) {
          return res
            .status(403)
            .send({ message: "You are not authorized to update this model" });
        }

        const update = { $set: data };
        const result = await modelCollection.updateOne(
          { _id: objectId },
          update
        );

        res.send({ success: true, result });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // delete
    // deleteOne
    // deleteMany

    app.delete("/models/:id", async (req, res) => {
      const { id } = req.params;
      //    const objectId = new ObjectId(id)
      // const filter = {_id: objectId}
      const result = await modelCollection.deleteOne({ _id: new ObjectId(id) });

      res.send({
        success: true,
        result,
      });
    });

    //    latest 6 data
    // get
    // find

    app.get("/latest-models", async (req, res) => {
      const result = await modelCollection
        .find()
        .sort({ createdAt: "desc" })
        .limit(6)
        .toArray();

      console.log(result);

      res.send(result);
    });

    app.get("/my-models", verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await modelCollection.find({ createdBy: email }).toArray();
      res.send(result);
    });

    app.post("/downloads/:id", async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      //downloads collection...
      const result = await downloadCollection.insertOne(data);

      //downloads counted
      const filter = { _id: new ObjectId(id) };
      const update = {
        $inc: {
          purchased: 1,
        },
      };
      const downloadCounted = await modelCollection.updateOne(filter, update);
      res.send({ result, downloadCounted });
    });

    app.get("/my-downloads", verifyToken, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        return res.status(400).send({
          success: false,
          message: "Email query parameter is required",
          result: [],
        });
      }

      try {
        const result = await downloadCollection
          .find({ purchasedBy: email })
          .toArray();

        res.send({
          success: true,
          result: result || [], // always return array
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({
          success: false,
          message: "Server error",
          result: [],
        });
      }
    });

    app.get("/search", async (req, res) => {
      const search_text = req.query.search;
      const result = await modelCollection
        .find({ name: { $regex: search_text, $options: "i" } })
        .toArray();
      res.send(result);
    });

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running fine!");
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
