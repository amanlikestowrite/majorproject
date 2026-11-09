const express =require("express")
const prisma = require("../../prisma/lib/prisma")
const userInputRouter = express.Router()

userInputRouter.post("/", async (req,res)=>{
    try{
        const {userId, content} = req.body

        if (!content){
            res.status(400).json({
                message: "Content is required"
            })
        }
        let user;
        if (userId){
            user = await prisma.user.findUnique({
                where: {
                    id: userId
                }
            })
        }
        if (!user){
            await prisma.user.create({})
        }

        const message = await prisma.user.create({
            data:{
                where: {
                    id: userId,
                    role: "User",
                    content
                }
            }
        })
        return res.status(201).json({
            message: "Message stored successfully",
            userId: user.id,
            data: message
        })
    }
    catch(err){
        console.error(error)

        return res.status(500).json({
            message: "Internal server error"
        })
    }
})



module.exports = userInputRouter