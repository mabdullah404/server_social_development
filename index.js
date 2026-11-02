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
// ফ্রন্টএন্ড যাতে ব্যাকএন্ডে ডেটা পাঠাতে পারে (CORS) এবং JSON ডেটা পড়তে পারে
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

// ==========================================
// ৫. JWT ভেরিফিকেশন মিডলওয়্যার
// ==========================================
// প্রাইভেট রাউটগুলো সুরক্ষিত রাখতে ক্লায়েন্ট থেকে পাঠানো টোকেন যাচাই করা হয়
const verifyToken = (req, res, next) => {
  const authorization = req.headers.authorization;

  // হেডার এ টোকেন না থাকলে ৪০১ স্ট্যাটাস ফেরত যাবে
  if (!authorization) {
    return res.status(401).send({ message: "অননুমোদিত অ্যাক্সেস (Unauthorized): টোকেন পাওয়া যায়নি!" });
  }

  // টোকেন "Bearer <token>" আকারে আসে, তাই স্প্লিট করে আসল টোকেনটি আলাদা করা হয়
  const token = authorization.split(" ")[1];

  if (!token) {
    return res.status(401).send({ message: "অননুমোদিত অ্যাক্সেস: টোকেন নেই!" });
  }

  // টোকেন সঠিক কিনা যাচাই
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "টোকেনটি অবৈধ বা মেয়াদোত্তীর্ণ (Invalid/Expired Token)!" });
    }
    // ভ্যালিড হলে ইউজার অবজেক্ট রিকোয়েস্টে সেট করে পরবর্তী পদক্ষেপে যাওয়া
    req.user = decoded;
    next();
  });
};

// ==========================================
// ৬. ডেটাবেস অপারেশন এবং রাউটসমূহ
// ==========================================
async function run() {
  try {
    // ডেটাবেস কানেকশন
    await client.connect();
    console.log("MongoDB এর সাথে সফলভাবে কানেক্ট হয়েছে!");

    const db = client.db("socialDevelopmentDB");
    const eventsCollection = db.collection("events");
    const joinedEventsCollection = db.collection("joinedEvents");
    const usersCollection = db.collection("users"); // অপশনাল রিকোয়ারমেন্ট: প্রোফাইল ম্যানেজমেন্টের জন্য

    // ----------------------------------------------------
    // ক. রুট রাউট (Health Check)
    // ----------------------------------------------------
    app.get("/", (req, res) => {
      res.send("Social Development Events Server সফলভাবে চলছে...");
    });

    // ----------------------------------------------------
    // খ. অথেনটিকেশন / JWT রাউট
    // ----------------------------------------------------
    // ফ্রন্টএন্ডে ইউজার সফলভাবে লগইন বা রেজিস্ট্রেশন করার পর টোকেন নেওয়ার জন্য
    app.post("/jwt", async (req, res) => {
      try {
        const user = req.body; // { email: "user@example.com" }
        if (!user || !user.email) {
          return res.status(400).send({ message: "ইমেইল ফিল্ড দেওয়া আবশ্যক!" });
        }

        // ৭ দিনের মেয়াদী JWT টোকেন তৈরি করা হচ্ছে
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
        res.send({ token });
      } catch (error) {
        console.error("JWT Error:", error);
        res.status(500).send({ message: "টোকেন তৈরিতে সমস্যা দেখা দিয়েছে!" });
      }
    });

    // ----------------------------------------------------
    // গ. পাবলিক ইভেন্ট রাউটসমূহ (লগইন ছাড়াই ব্যবহার করা যাবে)
    // ----------------------------------------------------

    // ১. হোম পেজের জন্য সাম্প্রতিক ৬টি আসন্ন ইভেন্ট
    // রিকোয়ারমেন্ট: Show 6 recent upcoming events(using .limit() operator of mongodb) based on date
    app.get("/recent-events", async (req, res) => {
      try {
        const todayStr = new Date().toISOString().split("T")[0];

        // শুধুমাত্র আজকের বা ভবিষ্যতের ইভেন্ট ফিল্টার
        const query = { eventDate: { $gte: todayStr } };

        const recentEvents = await eventsCollection
          .find(query)
          .sort({ eventDate: 1 }) // আসন্ন তারিখগুলো আগে আসবে
          .limit(6)               // মঙ্গোডিবির .limit(6)
          .toArray();

        res.send(recentEvents);
      } catch (error) {
        console.error("Recent Events Error:", error);
        res.status(500).send({ message: "সাম্প্রতিক ইভেন্ট লোড করতে সমস্যা হয়েছে!" });
      }
    });

    // ২. সকল আপকামিং ইভেন্ট (Upcoming Events Public Page)
    // রিকোয়ারমেন্ট: Events whose dates have passed must not appear on this page.
    app.get("/events", async (req, res) => {
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        const { search, eventType } = req.query;

        // ফিল্টার: অতীত তারিখ বাদ
        let query = { eventDate: { $gte: todayStr } };

        // ড্রপডাউন ফিল্টারিং (যেমন: Cleanup, Plantation, Donation)
        if (eventType && eventType !== "All") {
          query.eventType = eventType;
        }

        // টাইটেল বা লোকেশন দিয়ে সার্চ
        if (search) {
          query.$or = [
            { title: { $regex: search, $options: "i" } },
            { location: { $regex: search, $options: "i" } },
          ];
        }

        const events = await eventsCollection
          .find(query)
          .sort({ eventDate: 1 })
          .toArray();

        res.send(events);
      } catch (error) {
        console.error("Events fetch error:", error);
        res.status(500).send({ message: "ইভেন্ট তালিকা লোড করতে সমস্যা হয়েছে!" });
      }
    });

    // ৩. নির্দিষ্ট ইভেন্টের বিস্তারিত দেখা (Event Details Page - Public)
    // রিকোয়ারমেন্ট: The event details page is not a private page. Users can see without logging in.
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

    // ৪. প্ল্যাটফর্মের পরিসংখ্যান (Home Page বা যেকোনো পেজের জন্য এক্সট্রা ফিচার)
    app.get("/events-stats", async (req, res) => {
      try {
        const totalEvents = await eventsCollection.estimatedDocumentCount();
        const totalJoined = await joinedEventsCollection.estimatedDocumentCount();
        res.send({ totalEvents, totalJoined });
      } catch (error) {
        res.status(500).send({ message: "পরিসংখ্যান লোড করতে সমস্যা হয়েছে!" });
      }
    });

    // ----------------------------------------------------
    // ঘ. সুরক্ষিত ইভেন্ট রাউটসমূহ (প্রাইভেট - JWT Token প্রয়োজন)
    // ----------------------------------------------------

    // ৫. নতুন ইভেন্ট তৈরি করা (Create Event Page)
    // রিকোয়ারমেন্ট:
    // - Title, description, event type dropdown, thumbnail Image URL, location, event date.
    // - Ensure no past date can be added. The date must be in the future.
    // - Keep the user email with the event data.
    app.post("/events", verifyToken, async (req, res) => {
      try {
        const eventData = req.body;
        const { title, description, eventType, thumbnail, location, eventDate, userEmail, userName } = eventData;

        // ডেটা ভ্যালিডেশন
        if (!title || !description || !eventType || !thumbnail || !location || !eventDate || !userEmail) {
          return res.status(400).send({ message: "অনুগ্রহ করে সব তথ্য সঠিকভাবে প্রদান করুন!" });
        }

        // নিরাপত্তা যাচাই: যে ইউজার রিকোয়েস্ট পাঠাচ্ছে সে টোকেনধারী ব্যক্তি কিনা
        if (req.user.email !== userEmail) {
          return res.status(403).send({ message: "অনুমোদিত ব্যবহারকারী নন!" });
        }

        // অতীত তারিখ ভ্যালিডেশন
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

    // ৬. ইউজারের নিজের তৈরি ইভেন্টসমূহ দেখা (Manage Events Page)
    // রিকোয়ারমেন্ট: User will be able to see all events created by them.
    app.get("/manage-events", verifyToken, async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({ message: "ইমেইল প্যারামিটার দেওয়া আবশ্যক!" });
        }

        // টোকেনের ইমেইলের সাথে ক্লায়েন্টের ইমেইল ভেরিফাই করা
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

    // ৭. ইভেন্ট আপডেট করা (Update Event)
    // রিকোয়ারমেন্ট: Users can only delete and update their own created event data.
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

        // কেবল ইভেন্ট তৈরিকারী ইউজারই আপডেট করতে পারবে
        if (existingEvent.userEmail !== req.user.email) {
          return res.status(403).send({ message: "আপনি শুধুমাত্র আপনার তৈরি করা ইভেন্ট আপডেট করতে পারবেন!" });
        }

        // তারিখ পরিবর্তন করলে অতীত তারিখ কিনা চেক
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

    // ৮. ইভেন্ট ডিলিট করা (Delete Event)
    // রিকোয়ারমেন্ট: Users can only delete their own created event data.
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

        // শুধু ওনার ডিলিট করতে পারবে
        if (existingEvent.userEmail !== req.user.email) {
          return res.status(403).send({ message: "আপনি শুধুমাত্র আপনার তৈরি ইভেন্ট ডিলিট করতে পারবেন!" });
        }

        const result = await eventsCollection.deleteOne(query);

        // সংশ্লিষ্ট জয়েনিং রেকর্ড মুছে দেওয়া
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

    // ----------------------------------------------------
    // ঙ. জয়েন ইভেন্ট রাউটসমূহ (Join & Joined Events - Private)
    // ----------------------------------------------------

    // ৯. কোনো ইভেন্টে জয়েন করা (Join Event)
    // রিকোয়ারমেন্ট: When a user joins an event, store the data in the database along with the event and user data.
    app.post("/joined-events", verifyToken, async (req, res) => {
      try {
        const { eventId, eventTitle, eventDate, eventType, thumbnail, location, userEmail, userName } = req.body;

        if (!eventId || !userEmail) {
          return res.status(400).send({ message: "ইভেন্ট আইডি এবং ইউজার ইমেইল দেওয়া আবশ্যক!" });
        }

        // নিরাপত্তা যাচাই
        if (req.user.email !== userEmail) {
          return res.status(403).send({ message: "অননুমোদিত রিকোয়েস্ট!" });
        }

        // একই ইউজার বারবার জয়েন করা প্রতিরোধ
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

    // ১০. ইউজারের জয়েন করা সকল ইভেন্ট দেখা (Joined Events Page)
    // রিকোয়ারমেন্ট: This page will show all events joined by the logged-in user. Show events sorted by event date.
    app.get("/joined-events", verifyToken, async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({ message: "ইমেইল প্যারামিটার দেওয়া আবশ্যক!" });
        }

        if (req.user.email !== email) {
          return res.status(403).send({ message: "অননুমোদিত এক্সেস!" });
        }

        const query = { userEmail: email };

        // রিকোয়ারমেন্ট: ইভেন্টের তারিখ অনুযায়ী ক্রমানুসারে সাজানো
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

    // ----------------------------------------------------
    // চ. প্রোফাইল ম্যানেজমেন্ট (ঐচ্ছিক বোনাস রিকোয়ারমেন্ট: Profile view & update)
    // ----------------------------------------------------

    // ১১. ইউজারের প্রোফাইল তথ্য পাওয়া
    app.get("/users/profile", verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        if (!email || req.user.email !== email) {
          return res.status(403).send({ message: "অননুমোদিত প্রোফাইল এক্সেস!" });
        }

        const user = await usersCollection.findOne({ email });
        res.send(user || { email });
      } catch (error) {
        res.status(500).send({ message: "প্রোফাইল লোড করা যায়নি!" });
      }
    });

    // ১২. ইউজারের নাম ও প্রোফাইল ছবি আপডেট করা
    // রিকোয়ারমেন্ট (ঐচ্ছিক): The user will be able to update their name and profile picture.
    app.put("/users/profile", verifyToken, async (req, res) => {
      try {
        const { email, name, photoURL } = req.body;

        if (!email || req.user.email !== email) {
          return res.status(403).send({ message: "অননুমোদিত আপডেট রিকোয়েস্ট!" });
        }

        const filter = { email };
        const updateDoc = {
          $set: {
            name: name,
            photoURL: photoURL,
            updatedAt: new Date().toISOString(),
          },
        };
        const options = { upsert: true }; // ইউজার রেকর্ড না থাকলে নতুন তৈরি হবে

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

  } catch (error) {
    console.error("MongoDB কানেকশনে সমস্যা:", error);
  }
}

// ফাংশন চালানো
run().catch(console.dir);

// ==========================================
// ৭. সার্ভার লিসেনিং
// ==========================================
app.listen(port, () => {
  console.log(`Social Development Server চালু রয়েছে পোর্ট: ${port}-এ`);
});
