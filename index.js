import express from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import jwt from "jsonwebtoken";
import "dotenv/config";

// ==========================================
// ১. এক্সপ্রেস অ্যাপ ইনিশিয়ালাইজেশন
// ==========================================
const app = express();
const port = process.env.PORT || 5000;

// ==========================================
// ২. মিডলওয়্যার সেটআপ
// ==========================================
app.use(cors());
app.use(express.json());

// ==========================================
// ৩. সিক্রেট কি (JWT Token তৈরির জন্য)
// ==========================================
const JWT_SECRET = process.env.JWT_SECRET || "default_social_dev_secret_key_12345";

// ==========================================
// ৪. মঙ্গোডিবি কানেকশন ইউআরআই তৈরি
// ==========================================
const dbUser = process.env.MONGODB_USER || process.env.MONGDB_USER;
const dbPass = process.env.MONGODB_PASS || process.env.MONGDB_PASS;

const uri = `mongodb://${dbUser}:${dbPass}@ac-3ww2xt0-shard-00-00.wr4odv4.mongodb.net:27017,ac-3ww2xt0-shard-00-01.wr4odv4.mongodb.net:27017,ac-3ww2xt0-shard-00-02.wr4odv4.mongodb.net:27017/?ssl=true&replicaSet=atlas-11txxf-shard-0&authSource=admin`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ডেটাবেস এবং কালেকশন রেফারেন্স (Vercel সার্ভারলেসের জন্য টপ-লেভেলে ইনিশিয়ালাইজড)
const db = client.db("socialDevelopmentDB");
const eventsCollection = db.collection("events");
const joinedEventsCollection = db.collection("joinedEvents");
const usersCollection = db.collection("users");

// ব্যাকগ্রাউন্ডে কানেকশন চালু রাখা
async function connectDB() {
  try {
    await client.connect();
    console.log("MongoDB এর সাথে সফলভাবে কানেক্ট হয়েছে!");
  } catch (err) {
    console.error("MongoDB কানেকশনে সমস্যা:", err);
  }
}
connectDB();

// ==========================================
// ৫. JWT ভেরিফিকেশন মিডলওয়্যার
// ==========================================
const verifyToken = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({ message: "অননুমোদিত অ্যাক্সেস (Unauthorized): টোকেন পাওয়া যায়নি!" });
  }

  const token = authorization.split(" ")[1];

  if (!token) {
    return res.status(401).send({ message: "অননুমোদিত অ্যাক্সেস: টোকেন নেই!" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "টোকেনটি অবৈধ বা মেয়াদোত্তীর্ণ (Invalid/Expired Token)!" });
    }
    req.user = decoded;
    next();
  });
};

// ==========================================
// ৬. রাউটসমূহ (Routes)
// ==========================================

// ১. রুট রাউট (Health Check)
app.get("/", (req, res) => {
  res.send("Social Development Events Server সফলভাবে চলছে...");
});

// ২. অথেনটিকেশন / JWT রাউট
app.post("/jwt", async (req, res) => {
  try {
    const user = req.body;
    if (!user || !user.email) {
      return res.status(400).send({ message: "ইমেইল ফিল্ড দেওয়া আবশ্যক!" });
    }

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
    res.send({ token });
  } catch (error) {
    console.error("JWT Error:", error);
    res.status(500).send({ message: "টোকেন তৈরিতে সমস্যা দেখা দিয়েছে!" });
  }
});

// ৩. হোম পেজের সাম্প্রতিক ৬টি আসন্ন ইভেন্ট (.limit(6))
app.get("/recent-events", async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const query = { eventDate: { $gte: todayStr } };

    const recentEvents = await eventsCollection
      .find(query)
      .sort({ eventDate: 1 })
      .limit(6)
      .toArray();

    res.send(recentEvents);
  } catch (error) {
    console.error("Recent Events Error:", error);
    res.status(500).send({ message: "সাম্প্রতিক ইভেন্ট লোড করতে সমস্যা হয়েছে!" });
  }
});

// ৪. সকল আপকামিং ইভেন্ট (Upcoming Events Public Page)
app.get("/events", async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const { search, eventType } = req.query;

    let query = { eventDate: { $gte: todayStr } };

    if (eventType && eventType !== "All") {
      query.eventType = eventType;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    let cursor = eventsCollection.find(query).sort({ eventDate: 1 });

    if (req.query.limit) {
      cursor = cursor.limit(parseInt(req.query.limit));
    }

    const events = await cursor.toArray();
    res.send(events);
  } catch (error) {
    console.error("Events fetch error:", error);
    res.status(500).send({ message: "ইভেন্ট তালিকা লোড করতে সমস্যা হয়েছে!" });
  }
});

// ৫. নির্দিষ্ট ইভেন্টের বিস্তারিত দেখা (Event Details Page - Public)
app.get("/events/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "অকার্যকর ইভেন্ট আইডি ফরম্যাট!" });
    }

    const query = { _id: new ObjectId(id) };
    const event = await eventsCollection.findOne(query);

    if (!event) {
      return res.status(404).send({ message: "কোনো ইভেন্ট পাওয়া যায়নি!" });
    }

    res.send(event);
  } catch (error) {
    console.error("Single Event error:", error);
    res.status(500).send({ message: "ইভেন্ট লোড করতে সমস্যা হয়েছে!" });
  }
});

// ৬. প্ল্যাটফর্মের পরিসংখ্যান
app.get("/events-stats", async (req, res) => {
  try {
    const totalEvents = await eventsCollection.estimatedDocumentCount();
    const totalJoined = await joinedEventsCollection.estimatedDocumentCount();
    res.send({ totalEvents, totalJoined });
  } catch (error) {
    res.status(500).send({ message: "পরিসংখ্যান লোড করতে সমস্যা হয়েছে!" });
  }
});

// ৭. নতুন ইভেন্ট তৈরি করা (Create Event Page - Private)
app.post("/events", verifyToken, async (req, res) => {
  try {
    const eventData = req.body;
    const { title, description, eventType, thumbnail, location, eventDate, userEmail, userName } = eventData;

    if (!title || !description || !eventType || !thumbnail || !location || !eventDate || !userEmail) {
      return res.status(400).send({ message: "অনুগ্রহ করে সব তথ্য সঠিকভাবে প্রদান করুন!" });
    }

    if (req.user.email !== userEmail) {
      return res.status(403).send({ message: "অনুমোদিত ব্যবহারকারী নন!" });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (eventDate < todayStr) {
      return res.status(400).send({ message: "অতীতের তারিখ গ্রহণ করা হবে না! ভবিষ্যতের তারিখ নির্বাচন করুন।" });
    }

    const newEvent = {
      title,
      description,
      eventType,
      thumbnail,
      location,
      eventDate,
      userEmail,
      userName: userName || "Anonymous",
      createdAt: new Date().toISOString(),
    };

    const result = await eventsCollection.insertOne(newEvent);
    res.status(201).send({
      success: true,
      message: "ইভেন্টটি সফলভাবে যোগ করা হয়েছে!",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Create Event error:", error);
    res.status(500).send({ message: "ইভেন্ট যোগ করতে ব্যর্থ হয়েছে!" });
  }
});

// ৮. ইউজারের নিজের তৈরি ইভেন্টসমূহ দেখা (Manage Events Page - Private)
app.get("/manage-events", verifyToken, async (req, res) => {
  try {
    const email = req.query.email || req.user.email;

    if (req.user.email !== email) {
      return res.status(403).send({ message: "অননুমোদিত এক্সেস!" });
    }

    const query = { userEmail: email };
    const myEvents = await eventsCollection.find(query).sort({ eventDate: 1 }).toArray();

    res.send(myEvents);
  } catch (error) {
    console.error("Manage events error:", error);
    res.status(500).send({ message: "আপনার ইভেন্টগুলো লোড করা যায়নি!" });
  }
});

// ৯. ইভেন্ট আপডেট করা (Update Event - Private)
app.put("/events/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const updatedData = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "ভুল ইভেন্ট আইডি!" });
    }

    const query = { _id: new ObjectId(id) };
    const existingEvent = await eventsCollection.findOne(query);

    if (!existingEvent) {
      return res.status(404).send({ message: "ইভেন্ট পাওয়া যায়নি!" });
    }

    if (existingEvent.userEmail !== req.user.email) {
      return res.status(403).send({ message: "আপনি শুধুমাত্র আপনার তৈরি করা ইভেন্ট আপডেট করতে পারবেন!" });
    }

    if (updatedData.eventDate) {
      const todayStr = new Date().toISOString().split("T")[0];
      if (updatedData.eventDate < todayStr) {
        return res.status(400).send({ message: "অতীতের কোনো তারিখ গ্রহণ করা যাবে না!" });
      }
    }

    const updateDoc = {
      $set: {
        title: updatedData.title || existingEvent.title,
        description: updatedData.description || existingEvent.description,
        eventType: updatedData.eventType || existingEvent.eventType,
        thumbnail: updatedData.thumbnail || existingEvent.thumbnail,
        location: updatedData.location || existingEvent.location,
        eventDate: updatedData.eventDate || existingEvent.eventDate,
        updatedAt: new Date().toISOString(),
      },
    };

    const result = await eventsCollection.updateOne(query, updateDoc);
    res.send({
      success: true,
      message: "ইভেন্ট সফলভাবে আপডেট হয়েছে!",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Update event error:", error);
    res.status(500).send({ message: "ইভেন্ট আপডেট করতে সমস্যা হয়েছে!" });
  }
});

// ১০. ইভেন্ট ডিলিট করা (Delete Event - Private)
app.delete("/events/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "ভুল ইভেন্ট আইডি!" });
    }

    const query = { _id: new ObjectId(id) };
    const existingEvent = await eventsCollection.findOne(query);

    if (!existingEvent) {
      return res.status(404).send({ message: "ইভেন্ট পাওয়া যায়নি!" });
    }

    if (existingEvent.userEmail !== req.user.email) {
      return res.status(403).send({ message: "আপনি শুধুমাত্র আপনার তৈরি ইভেন্ট ডিলিট করতে পারবেন!" });
    }

    const result = await eventsCollection.deleteOne(query);
    await joinedEventsCollection.deleteMany({ eventId: id });

    res.send({
      success: true,
      message: "ইভেন্টটি সফলভাবে ডিলিট হয়েছে!",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Delete event error:", error);
    res.status(500).send({ message: "ইভেন্ট ডিলিট করতে ব্যর্থ হয়েছে!" });
  }
});

// ১১. কোনো ইভেন্টে জয়েন করা (Join Event - Private)
app.post("/joined-events", verifyToken, async (req, res) => {
  try {
    const { eventId, eventTitle, eventDate, eventType, thumbnail, location, userEmail, userName } = req.body;

    if (!eventId || !userEmail) {
      return res.status(400).send({ message: "ইভেন্ট আইডি এবং ইউজার ইমেইল দেওয়া আবশ্যক!" });
    }

    if (req.user.email !== userEmail) {
      return res.status(403).send({ message: "অননুমোদিত রিকোয়েস্ট!" });
    }

    const alreadyJoined = await joinedEventsCollection.findOne({
      eventId: eventId,
      userEmail: userEmail,
    });

    if (alreadyJoined) {
      return res.status(400).send({ message: "আপনি ইতিমধ্যে এই ইভেন্টে জয়েন করেছেন!" });
    }

    const joinRecord = {
      eventId,
      eventTitle,
      eventDate,
      eventType,
      thumbnail,
      location,
      userEmail,
      userName: userName || "Participant",
      joinedAt: new Date().toISOString(),
    };

    const result = await joinedEventsCollection.insertOne(joinRecord);
    res.status(201).send({
      success: true,
      message: "আপনি সফলভাবে ইভেন্টে জয়েন করেছেন!",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Join event error:", error);
    res.status(500).send({ message: "ইভেন্টে জয়েন করতে ব্যর্থ হয়েছে!" });
  }
});

// ১২. ইউজারের জয়েন করা সকল ইভেন্ট দেখা (Joined Events Page - Private)
app.get("/joined-events", verifyToken, async (req, res) => {
  try {
    const email = req.query.email || req.user.email;

    if (req.user.email !== email) {
      return res.status(403).send({ message: "অননুমোদিত এক্সেস!" });
    }

    const query = { userEmail: email };
    const joinedList = await joinedEventsCollection
      .find(query)
      .sort({ eventDate: 1 })
      .toArray();

    res.send(joinedList);
  } catch (error) {
    console.error("Joined events error:", error);
    res.status(500).send({ message: "জয়েন করা ইভেন্ট তালিকা লোড করতে সমস্যা হয়েছে!" });
  }
});

// ১৩. ইউজারের প্রোফাইল তথ্য পাওয়া (Private)
app.get("/users/profile", verifyToken, async (req, res) => {
  try {
    const email = req.query.email || req.user.email;
    if (req.user.email !== email) {
      return res.status(403).send({ message: "অননুমোদিত প্রোফাইল এক্সেস!" });
    }

    const user = await usersCollection.findOne({ email });
    res.send(user || { email });
  } catch (error) {
    res.status(500).send({ message: "প্রোফাইল লোড করা যায়নি!" });
  }
});

// ১৪. ইউজারের নাম ও প্রোফাইল ছবি আপডেট করা (Private)
app.put("/users/profile", verifyToken, async (req, res) => {
  try {
    const { email, name, photoURL } = req.body;
    const targetEmail = email || req.user.email;

    if (req.user.email !== targetEmail) {
      return res.status(403).send({ message: "অননুমোদিত আপডেট রিকোয়েস্ট!" });
    }

    const filter = { email: targetEmail };
    const updateDoc = {
      $set: {
        name: name,
        photoURL: photoURL,
        updatedAt: new Date().toISOString(),
      },
    };
    const options = { upsert: true };

    const result = await usersCollection.updateOne(filter, updateDoc, options);
    res.send({
      success: true,
      message: "প্রোফাইল সফলভাবে আপডেট হয়েছে!",
      result,
    });
  } catch (error) {
    res.status(500).send({ message: "প্রোফাইল আপডেট করতে সমস্যা হয়েছে!" });
  }
});

// ==========================================
// ৭. ৪০৪ হ্যান্ডলার (অন্য কোনো রাউট ম্যাচ না করলে)
// ==========================================
app.use((req, res) => {
  res.status(404).send({
    success: false,
    message: "অনুরোধকৃত রাউটটি খুঁজে পাওয়া যায়নি (Route Not Found)!",
  });
});

// ==========================================
// ৮. গ্লোবাল এরর হ্যান্ডলিং মিডলওয়্যার
// ==========================================
app.use((err, req, res, next) => {
  console.error("সার্ভার এরর:", err.stack);
  res.status(500).send({
    success: false,
    message: "সার্ভারে অপ্রত্যাশিত কোনো সমস্যা দেখা দিয়েছে!",
  });
});

// ==========================================
// ৯. সার্ভার লিসেনিং ও এক্সপোর্ট
// ==========================================
if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`Social Development Server চালু রয়েছে পোর্ট: ${port}-এ`);
  });
}

export default app;
