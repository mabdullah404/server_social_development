import { MongoClient } from "mongodb";
import "dotenv/config";

const dbUser = process.env.MONGODB_USER || process.env.MONGDB_USER;
const dbPass = process.env.MONGODB_PASS || process.env.MONGDB_PASS;

const uri = `mongodb://${dbUser}:${dbPass}@ac-3ww2xt0-shard-00-00.wr4odv4.mongodb.net:27017,ac-3ww2xt0-shard-00-01.wr4odv4.mongodb.net:27017,ac-3ww2xt0-shard-00-02.wr4odv4.mongodb.net:27017/?ssl=true&replicaSet=atlas-11txxf-shard-0&authSource=admin`;

const sampleEvents = [
  {
    title: "Winter Clothes Distribution",
    description: "Collecting and distributing warm winter clothes, sweaters, and blankets to destitute families living on the streets.",
    eventType: "Donation",
    thumbnail: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=800&auto=format&fit=crop",
    location: "Mirpur 10, Dhaka",
    eventDate: "2026-11-20",
    userEmail: "organizer@socialdev.org",
    userName: "Community Helper",
    createdAt: new Date().toISOString(),
  },
  {
    title: "Blanket Distribution for the Needy",
    description: "Night drive to distribute high quality warm blankets to homeless people in Mohammadpur and nearby bus stations.",
    eventType: "Donation",
    thumbnail: "https://images.unsplash.com/photo-1593113598332-cd288d649433?q=80&w=800&auto=format&fit=crop",
    location: "Mohammadpur, Dhaka",
    eventDate: "2026-11-25",
    userEmail: "organizer@socialdev.org",
    userName: "Community Helper",
    createdAt: new Date().toISOString(),
  },
  {
    title: "Green City Tree Plantation Campaign",
    description: "Planting 500 fruit and herbal trees along the roadside and lake walkways to fight urban warming and promote biodiversity.",
    eventType: "Plantation",
    thumbnail: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=800&auto=format&fit=crop",
    location: "Dhanmondi Lake, Dhaka",
    eventDate: "2026-12-05",
    userEmail: "greenearth@socialdev.org",
    userName: "Green Earth Volunteer",
    createdAt: new Date().toISOString(),
  },
  {
    title: "Clean Neighborhood & Waste Management Drive",
    description: "Community cleanup rally to clear plastic waste, unblock drains, and set up segregated recycling bins.",
    eventType: "Cleanup",
    thumbnail: "https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?q=80&w=800&auto=format&fit=crop",
    location: "Uttara Sector 7, Dhaka",
    eventDate: "2026-12-10",
    userEmail: "cleanbangla@socialdev.org",
    userName: "Clean City Initiative",
    createdAt: new Date().toISOString(),
  },
  {
    title: "Emergency Voluntary Blood Donation Camp",
    description: "Collaborative voluntary blood donation camp for Thalassemia patients and public hospital blood banks.",
    eventType: "Donation",
    thumbnail: "https://images.unsplash.com/photo-1615461066841-6116e61058f4?q=80&w=800&auto=format&fit=crop",
    location: "TSC, Dhaka University, Dhaka",
    eventDate: "2026-12-18",
    userEmail: "lifesavers@socialdev.org",
    userName: "Life Savers Youth",
    createdAt: new Date().toISOString(),
  },
  {
    title: "Free Medical Checkup & Medicine Distribution",
    description: "Specialist doctors providing free consultations, blood glucose check, and essential prescription medicines.",
    eventType: "Healthcare",
    thumbnail: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?q=80&w=800&auto=format&fit=crop",
    location: "Rampura, Dhaka",
    eventDate: "2026-12-28",
    userEmail: "healthcare@socialdev.org",
    userName: "Care Foundation",
    createdAt: new Date().toISOString(),
  },
  {
    title: "School Supplies & Books Donation for Children",
    description: "Providing backpacks, notebooks, pens, and storybooks to 200 slum children to encourage primary education.",
    eventType: "Donation",
    thumbnail: "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=800&auto=format&fit=crop",
    location: "Korail Slum, Banani, Dhaka",
    eventDate: "2027-01-05",
    userEmail: "teachhope@socialdev.org",
    userName: "Teach For All",
    createdAt: new Date().toISOString(),
  }
];

async function seed() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB for seeding...");
    const db = client.db("socialDevelopmentDB");
    const eventsCollection = db.collection("events");

    // ইনসার্ট করার আগে চেক করা
    const count = await eventsCollection.countDocuments();
    if (count === 0) {
      await eventsCollection.insertMany(sampleEvents);
      console.log(`সফলভাবে ${sampleEvents.length} টি নমুনা ইভেন্ট ডাটাবেসে যোগ করা হয়েছে!`);
    } else {
      console.log(`ডাটাবেসে ইতিমধ্যে ${count} টি ইভেন্ট বিদ্যমান রয়েছে।`);
    }
  } catch (error) {
    console.error("Seeding error:", error);
  } finally {
    await client.close();
  }
}

seed();

