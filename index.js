import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import 'dotenv/config'

const app = express();
const port = process.env.PORT || 5000;

//midleware
app.use(cors());
app.use(express.json());

const client = new MongoClient(`mongodb://${process.env.MONGODB_USER}:${process.env.MONGODB_PASS}@ac-3ww2xt0-shard-00-00.wr4odv4.mongodb.net:27017,ac-3ww2xt0-shard-00-01.wr4odv4.mongodb.net:27017,ac-3ww2xt0-shard-00-02.wr4odv4.mongodb.net:27017/?ssl=true&replicaSet=atlas-11txxf-shard-0&authSource=admin`,
);

export async function connectToMongoDB() {
  try {
    await client.connect();
        console.log("You successfully connected to MongoDB!");
            return client;
  } catch (err) {
        console.dir(err);
  }
}

app.get("/", (req, res) => {
  res.send("server CRUD Server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
