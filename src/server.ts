import fastify from "fastify";
import cors from '@fastify/cors'
import { appRoutes } from "./routes";

const app = fastify()
const PORT = 5000

app.register(cors)
app.register(appRoutes)

app.listen(
    {port:PORT}
).then(() => {
    console.log(`[..]⚡Server is running on: ${PORT}`)
})