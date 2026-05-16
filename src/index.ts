import { ApolloServer } from "@apollo/server";
import typeDefs from "./schemas/typeDefs.js";
import { resolvers } from "./resolvers.js";
import { startStandaloneServer } from "@apollo/server/standalone";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mi_viz";

async function connectMongo(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI, { dbName: process.env.MONGODB_DB || "mi_viz" });
    console.log(`mongo connected: ${MONGODB_URI}`);
  } catch (error) {
    console.error("mongo connection failed; continuing without persistence", error);
  }
}

const server = new ApolloServer({ typeDefs, resolvers });

void (async () => {
  await connectMongo();
  const { url } = await startStandaloneServer(server, {
    listen: { port: Number(process.env.PORT ?? 7004) },
  });
  console.log(`example-graphql ready at ${url}`);
})();