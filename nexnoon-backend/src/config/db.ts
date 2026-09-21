import mongoose from "mongoose";
import { setServers } from "node:dns/promises";
import { ENV } from "./env";

export const connectDB = async () => {
  try {
    const servers = ENV.MONGODB_DNS_SERVERS.split(',').map(value => value.trim()).filter(Boolean);
    if (ENV.MONGODB_URI.startsWith('mongodb+srv://') && servers.length) {
      setServers(servers);
    }
    await mongoose.connect(ENV.MONGODB_URI, { serverSelectionTimeoutMS: 15000, connectTimeoutMS: 10000 });
    // Build/sync indexes (e.g. the webhook-event and schedule uniqueness guards)
    // before serving traffic, so the very first request after a fresh deploy can't
    // race an in-progress index build and slip past a uniqueness constraint.
    await mongoose.connection.syncIndexes();
    console.log("✅ MongoDB connected successfully");
    console.log(
      `   Database: ${ENV.MONGODB_URI.split("/").pop()?.split("?")[0]}`,
    );
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    console.error("\n💡 Troubleshooting:");
    console.error(
      "   1. Is MongoDB running? (local) or cluster active? (Atlas)",
    );
    console.error("   2. Check MONGODB_URI in .env file");
    console.error("   3. Verify network access (Atlas IP whitelist)");
    console.error("   4. Check username/password in connection string");
    process.exit(1);
  }
};
