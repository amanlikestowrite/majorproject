const express = require("express")
const healthRouter = require("./routes/health.route")
const userInputRouter = require("./routes/userInput.route")
const app = express()

app.use(express.json())

app.use("/userInput",userInputRouter)

app.use("/",healthRouter)

module.exports = app