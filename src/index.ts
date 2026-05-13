import { ApolloServer } from "@apollo/server";
import typeDefs from "./schemas/typeDefs.js";
import { resolvers } from "./resolvers.js";
import { startStandaloneServer } from "@apollo/server/standalone";

const server = new ApolloServer({ typeDefs, resolvers });

startStandaloneServer(server, {
  listen: { port: Number(process.env.PORT ?? 7004) },
}).then(({ url }) => {
  console.log(`example-graphql ready at ${url}`);
});