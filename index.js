import express from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import jwt from "jsonwebtoken";
import "dotenv/config";

// ১. এক্সপ্রেস অ্যাপ ইনিশিয়ালাইজেশন
const app = express();
const port = process.env.PORT || 5000;

// ২. মিডলওয়্যার সেটআপ
// ক্রস-অরিজিন রিকোয়েস্ট এবং JSON ডাটা পার্স করার জন্য
app.use(cors());
app.use(express.json());

// ৩. সিক্রেট কি (JWT Token তৈরির জন্য)
const JWT_SECRET = process.env.JWT_SECRET || "default_social_dev_secret_key_12345";

// ৪. মঙ্গোডিবি কানেকশন ইউআরআই তৈরি
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

// ৫. JWT ভেরিফিকেশন মিডলওয়্যার (Custom Middleware)
// প্রাইভেট রাউটগুলো সুরক্ষিত রাখতে ক্লায়েন্ট থেকে পাঠানো টোকেন যাচাই করবে
const verifyToken = (req, res, next) => {
  const authorization = req.headers.authorization;

  // হেডার এ টোকেন না থাকলে আনঅথোরাইজড
  if (!authorization) {
    return res.status(401).send({ message: "অননুমোদিত অ্যাক্সেস (Unauthorized access): টোকেন পাওয়া যায়নি!" });
  }

  // টোকেনটি "Bearer <token>" আকারে আসে, তাই আলাদা করে নিচ্ছি
  const token = authorization.split(" ")[1];

  if (!token) {
    return res.status(401).send({ message: "অননুমোদিত অ্যাক্সেস: টোকেন পাওয়া যায়নি!" });
  }

  // টোকেন ভ্যালিড কিনা চেক করা হচ্ছে
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "টোকেনটি অবৈধ বা মেয়াদোত্তীর্ণ (Invalid or expired token)!" });
    }
    // টোকেন সঠিক হলে ডিকোডেড ডাটা রিকোয়েস্টে রেখে পরের ধাপে পাঠানো হচ্ছে
    req.user = decoded;
    next();
  });
};

// ৬. প্রধান ডেটাবেস ও রাউট ফাংশন
async function run() {
  try {
    // ডেটাবেসের সাথে কানেক্ট হওয়া
    await client.connect();
    console.log("MongoDB এর সাথে সফলভাবে কানেক্ট হয়েছে!");

    // ডেটাবেস এবং কালেকশন সিলেক্ট করা
    const db = client.db("socialDevelopmentDB");
    const eventsCollection = db.collection("events");
    const joinedEventsCollection = db.collection("joinedEvents");

    // ==========================================
    // ক. অথেনটিকেশন / JWT রাউট
    // ==========================================
    // ফ্রন্টএন্ডে ইউজার লগইন করার পর এই রাউটে ইউজারের ইমেইল পাঠালে টোকেন রিটার্ন করবে
    app.post("/jwt", async (req, res) => {
      try {
        const user = req.body; // { email: "user@example.com" }
        if (!user || !user.email) {
          return res.status(400).send({ message: "ইমেইল প্রদান করা আবশ্যক!" });
        }

        // টোকেন সাইন করা (৭ দিনের মেয়াদ)
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
        res.send({ token });
      } catch (error) {
        console.error("JWT Error:", error);
        res.status(500).send({ message: "টোকেন তৈরিতে সমস্যা হয়েছে!" });
      }
    });

    // ==========================================
    // খ. পাবলিক ইভেন্ট রাউটসমূহ (লগইন ছাড়া দেখা যাবে)
    // ==========================================

    // ১. সার্ভার রুট চেক
    app.get("/", (req, res) => {
      res.send("Social Development Events Server চলছে...");
    });

    // ২. হোম পেজের জন্য সাম্প্রতিক ৬টি আপকামিং ইভেন্ট (.limit() ব্যবহার করে)
    // রিকোয়ারমেন্ট: Recent Upcoming Events Section: Show 6 recent upcoming events(using .limit() operator of mongodb) based on date
    app.get("/recent-events", async (req, res) => {
      try {
        // আজকের তারিখ বের করা (YYYY-MM-DD ফরম্যাটে) যেন অতীতের ইভেন্ট বাদ থাকে
        const todayStr = new Date().toISOString().split("T")[0];

        // ফিল্টার: ইভেন্টের তারিখ আজকের বা ভবিষ্যতের হতে হবে
        const query = { eventDate: { $gte: todayStr } };

        // তারিখ অনুযায়ী ক্রমানুসারে সাজিয়ে প্রথম ৬টি ইভেন্ট নেওয়া
        const recentEvents = await eventsCollection
          .find(query)
          .sort({ eventDate: 1 }) // নিকটের তারিখগুলো আগে আসবে
          .limit(6)
          .toArray();

        res.send(recentEvents);
      } catch (error) {
        console.error("Recent Events Error:", error);
        res.status(500).send({ message: "সাম্প্রতিক ইভেন্ট লোড করতে ব্যর্থ হয়েছে!" });
      }
    });

    // ৩. সকল আপকামিং ইভেন্ট (Upcoming Events Public Page)
    // রিকোয়ারমেন্ট: Keep in mind that this page will only show upcoming events. Events whose dates have passed must not appear on this page.
    app.get("/events", async (req, res) => {
      try {
        const todayStr = new Date().toISOString().split("T")[0];

        // অপশনাল সার্চ এবং ফিল্টার সাপোর্ট (যদি ফ্রন্টএন্ড থেকে search বা eventType পাঠানো হয়)
        const { search, eventType } = req.query;
        let query = { eventDate: { $gte: todayStr } };

        // ইভেন্ট টাইপ ফিল্টার (যেমন: Cleanup, Plantation, Donation)
        if (eventType && eventType !== "All") {
          query.eventType = eventType;
        }

        // সার্চ কুয়েরি (টাইটেল বা লোকেশন অনুযায়ী)
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

    // ৪. সিঙ্গেল ইভেন্ট বিস্তারিত দেখা (Event Details Page - Public)
    // রিকোয়ারমেন্ট: The event details page is not a private page. Users can see the details page without logging in.
    app.get("/events/:id", async (req, res) => {
      try {
        const id = req.params.id;

        // মঙ্গোডিবি অবজেক্ট আইডি ভ্যালিডেশন
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "ভুল ইভেন্ট আইডি ফরম্যাট!" });
        }

        const query = { _id: new ObjectId(id) };
        const event = await eventsCollection.findOne(query);

        if (!event) {
          return res.status(404).send({ message: "ইভেন্টটি পাওয়া যায়নি!" });
        }

        res.send(event);
      } catch (error) {
        console.error("Single Event error:", error);
        res.status(500).send({ message: "ইভেন্ট লোড করতে সমস্যা হয়েছে!" });
      }
    });

    // ==========================================
    // গ. প্রাইভেট/সুরক্ষিত ইভেন্ট রাউটসমূহ (লগইন করা আবশ্যক)
    // ==========================================

    // ৫. নতুন ইভেন্ট তৈরি করা (Create Event Page)
    // রিকোয়ারমেন্ট:
    // - Title, description, event type dropdown (Cleanup, Plantation, Donation, etc.),
    //   thumbnail Image URL, location, event date.
    // - Ensure that no past date can be added. The date must be in the future.
    // - You need to keep the user email with the event data.
    app.post("/events", verifyToken, async (req, res) => {
      try {
        const eventData = req.body;
        const { title, description, eventType, thumbnail, location, eventDate, userEmail, userName } = eventData;

        // ভ্যালিডেশন চেক
        if (!title || !description || !eventType || !thumbnail || !location || !eventDate || !userEmail) {
          return res.status(400).send({ message: "সবগুলো ফিল্ড সঠিকভাবে পূরণ করুন!" });
        }

        // টোকেনের ইউজার ও ইভেন্ট ক্রিয়েটরের ইমেইল যাচাই
        if (req.user.email !== userEmail) {
          return res.status(403).send({ message: "নিষিদ্ধ এক্সেস: অনুমোদিত ব্যবহারকারী নন!" });
        }

        // অতীত তারিখ ভ্যালিডেশন (Past date check)
        const todayStr = new Date().toISOString().split("T")[0];
        if (eventDate < todayStr) {
          return res.status(400).send({ message: "অতীতের কোনো তারিখ দেওয়া যাবে না! ভবিষ্যতের তারিখ নির্বাচন করুন।" });
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
          message: "ইভেন্টটি সফলভাবে তৈরি করা হয়েছে!",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Create Event error:", error);
        res.status(500).send({ message: "ইভেন্ট তৈরি করতে ব্যর্থ হয়েছে!" });
      }
    });

    // ৬. ইউজারের নিজের তৈরি করা ইভেন্টসমূহ দেখা (Manage Events Page)
    // রিকোয়ারমেন্ট: From this page, the user will be able to see all events created by them.
    app.get("/manage-events", verifyToken, async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({ message: "ইমেইল প্যারামিটার দেওয়া আবশ্যক!" });
        }

        // টোকেনের ইমেইলের সাথে পাঠানো ইমেইল মেলানো
        if (req.user.email !== email) {
          return res.status(403).send({ message: "নিষিদ্ধ এক্সেস (Forbidden access)!" });
        }

        const query = { userEmail: email };
        const myEvents = await eventsCollection.find(query).sort({ eventDate: 1 }).toArray();

        res.send(myEvents);
      } catch (error) {
        console.error("Manage events error:", error);
        res.status(500).send({ message: "আপনার তৈরি ইভেন্টগুলো লোড করতে ব্যর্থ হয়েছে!" });
      }
    });

    // ৭. ইভেন্ট আপডেট করা (Update Event)
    // রিকোয়ারমেন্ট: update any event data. Users can only delete and update their own created event data.
    app.put("/events/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "ভুল ইভেন্ট আইডি!" });
        }

        // পূর্বের ইভেন্টটি খুঁজে দেখা
        const query = { _id: new ObjectId(id) };
        const existingEvent = await eventsCollection.findOne(query);

        if (!existingEvent) {
          return res.status(404).send({ message: "ইভেন্টটি পাওয়া যায়নি!" });
        }

        // শুধু যে ইউজার ইভেন্ট তৈরি করেছে সে-ই আপডেট করতে পারবে
        if (existingEvent.userEmail !== req.user.email) {
          return res.status(403).send({ message: "আপনি শুধুমাত্র নিজের তৈরি করা ইভেন্ট আপডেট করতে পারবেন!" });
        }

        // তারিখ আপডেট করলে অতীত তারিখ দেওয়া যাবে না
        if (updatedData.eventDate) {
          const todayStr = new Date().toISOString().split("T")[0];
          if (updatedData.eventDate < todayStr) {
            return res.status(400).send({ message: "অতীতের তারিখ দেওয়া যাবে না!" });
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
          message: "ইভেন্ট সফলভাবে আপডেট করা হয়েছে!",
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error("Update event error:", error);
        res.status(500).send({ message: "ইভেন্ট আপডেট করতে ব্যর্থ হয়েছে!" });
      }
    });

    // ৮. ইভেন্ট ডিলিট করা (Delete Event)
    // রিকোয়ারমেন্ট: Users can only delete and update their own created event data.
    app.delete("/events/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "ভুল ইভেন্ট আইডি!" });
        }

        const query = { _id: new ObjectId(id) };
        const existingEvent = await eventsCollection.findOne(query);

        if (!existingEvent) {
          return res.status(404).send({ message: "ইভেন্টটি পাওয়া যায়নি!" });
        }

        // শুধু ওনার ডিলিট করতে পারবে
        if (existingEvent.userEmail !== req.user.email) {
          return res.status(403).send({ message: "আপনি শুধুমাত্র নিজের তৈরি করা ইভেন্ট ডিলিট করতে পারবেন!" });
        }

        const result = await eventsCollection.deleteOne(query);

        // সাথে সাথে এই ইভেন্টে যতজন জয়েন করেছিল তাদের জয়েনিং রেকর্ডও চাইলে ক্লিয়ার করতে পারি
        await joinedEventsCollection.deleteMany({ eventId: id });

        res.send({
          success: true,
          message: "ইভেন্টটি সফলভাবে ডিলিট করা হয়েছে!",
          deletedCount: result.deletedCount,
        });
      } catch (error) {
        console.error("Delete event error:", error);
        res.status(500).send({ message: "ইভেন্ট ডিলিট করতে ব্যর্থ হয়েছে!" });
      }
    });

    // ==========================================
    // ঘ. জয়েন ইভেন্ট রাউটসমূহ (Join & Joined Events)
    // ==========================================

    // ৯. কোনো ইভেন্টে জয়েন করা (Join Event)
    // রিকোয়ারমেন্ট: When a user joins an event, store the data in the database along with the event and user data.
    app.post("/joined-events", verifyToken, async (req, res) => {
      try {
        const { eventId, eventTitle, eventDate, eventType, thumbnail, location, userEmail, userName } = req.body;

        if (!eventId || !userEmail) {
          return res.status(400).send({ message: "ইভেন্ট আইডি এবং ইউজার ইমেইল আবশ্যক!" });
        }

        // টোকেনের ইউজার ও রিকোয়েস্টের ইমেইল যাচাই
        if (req.user.email !== userEmail) {
          return res.status(403).send({ message: "অননুমোদিত রিকোয়েস্ট!" });
        }

        // ইতিমধ্যে ইউজার জয়েন করেছে কিনা চেক করা (Duplicate join prevention)
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
          return res.status(403).send({ message: "নিষিদ্ধ এক্সেস!" });
        }

        const query = { userEmail: email };

        // রিকোয়ারমেন্ট অনুযায়ী eventDate দিয়ে সাজানো হচ্ছে
        const joinedList = await joinedEventsCollection
          .find(query)
          .sort({ eventDate: 1 })
          .toArray();

        res.send(joinedList);
      } catch (error) {
        console.error("Joined events error:", error);
        res.status(500).send({ message: "জয়েন করা ইভেন্ট লোড করতে ব্যর্থ হয়েছে!" });
      }
    });
  } catch (error) {
    console.error("MongoDB Connection Failed:", error);
  }
}

// ফাংশন রান করা
run().catch(console.dir);

// ৭. সার্ভার লিসেনিং
app.listen(port, () => {
  console.log(`Social Development Server চালু রয়েছে পোর্ট: ${port}-এ`);
});
