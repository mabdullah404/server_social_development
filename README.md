# Social Development Events Platform - Server (Backend)

একটি কমিউনিটি-ভিত্তিক সোশ্যাল ডেভেলপমেন্ট ও সমাজসেবা ইভেন্ট ম্যানেজমেন্ট প্ল্যাটফর্মের ব্যাকএন্ড সার্ভার (Express.js, MongoDB, JWT)।

---

## 🌐 লাইভ লিঙ্কসমূহ (Live URLs)
- **Live Client Site (Frontend):** [https://social-development-platform.vercel.app](https://social-development-platform.vercel.app)
- **Live Server API (Backend):** [https://social-development-server-sigma.vercel.app](https://social-development-server-sigma.vercel.app)

---

## ✨ প্ল্যাটফর্মের মূল বৈশিষ্ট্যসমূহ (Core Features)
- **আসন্ন সমাজসেবা ইভেন্ট তালিকা:** স্থানীয় বিভিন্ন মানবিক উদ্যোগ ও ক্যাম্পেইনের তালিকা প্রদর্শন।
- **হোমপেজ সাম্প্রতিক ইভেন্ট (.limit(6)):** মঙ্গোডিবির কুয়েরি দিয়ে তাৎক্ষণিক ৬টি আসন্ন ইভেন্ট রেন্ডার।
- **নিরাপদ ইভেন্ট ক্রিয়েশন ও ভ্যালিডেশন:** অতীতের তারিখ ব্লক করে শুধু ভবিষ্যৎ তারিখের জন্য ইভেন্ট তৈরি ও ইউজারের ইমেইল ট্র্যাক।
- **ইভেন্টে অংশগ্রহণ (Join Event):** ভলান্টিয়ার হিসেবে একক ক্লিকে ইভেন্টে জয়েন ও ডুপ্লিকেট রেজিস্ট্রেশন প্রতিরোধ।
- **JWT সিকিউরিটি ও ইউজার অথোরাইজেশন:** প্রাইভেট রাউটগুলো (Create, Manage, Joined) নিরাপদ রাখতে বিয়ারার টোকেন ভেরিফিকেশন।

---

## 🛠️ ব্যবহৃত টেকনোলজি (Tech Stack)
- **Node.js** & **Express.js** (Backend Framework)
- **MongoDB Native Driver** (Database)
- **JSON Web Token (JWT)** (Secure Authentication & Route Protection)
- **CORS & Dotenv** (Security & Environment Config)

---

## 📋 এনভায়রনমেন্ট ভেরিয়েবল (.env.example)
প্রজেক্টের রুট ডিরেক্টরিতে একটি `.env` ফাইল তৈরি করে নিচের ভ্যারিয়েবলগুলো কনফিগার করুন:
```env
MONGODB_USER=your_mongodb_username
MONGODB_PASS=your_mongodb_password
PORT=5000
JWT_SECRET=your_jwt_secret_key
```

---

## 🚀 সার্ভার রান করার নিয়ম
```bash
# ডিপেন্ডেন্সি ইনস্টল (যদি ইতিমধ্যে না থাকে)
npm install

# ডাটাবেসে নমুনা ডেটা যুক্ত করতে (একবার চালাতে পারেন)
npm run seed

# সার্ভার চালু করতে
npm start
```
সার্ভারটি ডিফল্টভাবে `http://localhost:5000` এ রান হবে।

---

## 📡 এপিআই এন্ডপয়েন্ট তালিকা (API Endpoints & Documentation)

### ১. অথেনটিকেশন (Authentication / JWT)
- **POST `/jwt`**
  - **কাজ:** লগইন করার পর ইউজারের ইমেইল পাঠিয়ে JWT টোকেন গ্রহণ করা।
  - **Headers:** `Content-Type: application/json`
  - **Body:**
    ```json
    {
      "email": "user@example.com"
    }
    ```
  - **Response:**
    ```json
    {
      "token": "eyJhbGciOi..."
    }
    ```
  - *নোট:* ফ্রন্টএন্ডে এই টোকেনটি `localStorage` বা মেমোরিতে সংরক্ষণ করে পরবর্তী প্রাইভেট রিকোয়েস্টে `Authorization: Bearer <token>` হেডার হিসেবে পাঠাতে হবে।

---

### ২. পাবলিক রাউটসমূহ (লগইন ছাড়া সবার জন্য উন্মুক্ত)

- **GET `/`**
  - সার্ভারের রানিং স্ট্যাটাস চেক।

- **GET `/recent-events`**
  - **কাজ:** হোম পেজের (Recent Upcoming Events) জন্য সাম্প্রতিক ৬টি আসন্ন ইভেন্ট পাওয়া।
  - MongoDB-র `.limit(6)` এবং তারিখ অনুযায়ী সাজানো। অতীতের কোনো ইভেন্ট আসবে না।

- **GET `/events`**
  - **কাজ:** আপকামিং ইভেন্টস পেজের জন্য সকল আসন্ন ইভেন্ট তালিকা।
  - **Query Params (ঐচ্ছিক):** 
    - `?eventType=Cleanup` (ইভেন্ট টাইপ ফিল্টার)
    - `?search=Mirpur` (নাম বা লোকেশন সার্চ)

- **GET `/events/:id`**
  - **কাজ:** নির্দিষ্ট কোনো ইভেন্টের সম্পূর্ণ বিস্তারিত তথ্য দেখা (Event Details Page)।

- **GET `/events-stats`**
  - **কাজ:** মোট ইভেন্ট ও মোট জয়েন করা ইউজারের সংখ্যা দেখা।

---

### ৩. প্রাইভেট রাউটসমূহ (লগইন করা আবশ্যক - JWT ভেরিফাইড)
> ⚠️ **গুরুত্বপূর্ণ:** নিচের সকল প্রাইভেট রিকোয়েস্টে `headers`-এ টোকেন পাঠাতে হবে:
> `Authorization: Bearer <your_jwt_token>`

- **POST `/events` (Create Event)**
  - **কাজ:** নতুন ইভেন্ট তৈরি করা।
  - **Body:**
    ```json
    {
      "title": "Winter Clothes Distribution",
      "description": "Distributing warm clothes to needy families.",
      "eventType": "Donation",
      "thumbnail": "https://example.com/image.jpg",
      "location": "Mirpur 10, Dhaka",
      "eventDate": "2026-12-15",
      "userEmail": "user@example.com",
      "userName": "User Name"
    }
    ```
  - *শর্ত:* `eventDate` অবশ্যই বর্তমান তারিখ বা ভবিষ্যতের হতে হবে। অতীতের তারিখ গ্রহণ করা হবে না।

- **GET `/manage-events?email=user@example.com` (Manage Events)**
  - **কাজ:** লগইন করা ইউজারের নিজের তৈরি করা সকল ইভেন্ট দেখা।

- **PUT `/events/:id` (Update Event)**
  - **কাজ:** ইউজারের তৈরি ইভেন্টের তথ্য আপডেট করা (অন্য ইউজারের ইভেন্ট আপডেট করা যাবে না)।
  - **Body:** যে ফিল্ডগুলো পরিবর্তন করতে চান।

- **DELETE `/events/:id` (Delete Event)**
  - **কাজ:** নিজের তৈরি ইভেন্ট মুছে ফেলা।

- **POST `/joined-events` (Join Event)**
  - **কাজ:** কোনো ইভেন্টে যুক্ত হওয়া।
  - **Body:**
    ```json
    {
      "eventId": "65b...",
      "eventTitle": "Winter Clothes Distribution",
      "eventDate": "2026-12-15",
      "eventType": "Donation",
      "thumbnail": "https://example.com/image.jpg",
      "location": "Mirpur 10, Dhaka",
      "userEmail": "user@example.com",
      "userName": "User Name"
    }
    ```

- **GET `/joined-events?email=user@example.com` (Joined Events)**
  - **কাজ:** লগইন করা ইউজারের জয়েন করা সকল ইভেন্ট তারিখ অনুযায়ী সাজিয়ে দেখা।

- **GET `/users/profile?email=user@example.com` (Get Profile - Optional Feature)**
  - **কাজ:** ইউজারের প্রোফাইল ডাটা পাওয়া।

- **PUT `/users/profile` (Update Profile - Optional Feature)**
  - **কাজ:** ইউজারের নাম ও প্রোফাইল ছবি আপডেট করা।
  - **Body:**
    ```json
    {
      "email": "user@example.com",
      "name": "Updated Name",
      "photoURL": "https://example.com/photo.jpg"
    }
    ```
