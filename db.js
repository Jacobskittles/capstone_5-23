const express = require("express");
const app = express();
const { MongoClient } = require("mongodb");
const path = require("path");

const port = 8080;
const uri = "mongodb://localhost:27017/";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri);

// Connect to the MongoDB server
async function connect() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
}
connect();

//useful code

const db = client.db("CBProjects");

let personnel;
let projects;

async function fillData() {
    personnel = await db.collection("personnel").find().toArray();
    projects = await db.collection("projects").find().toArray();
    console.log(personnel)
}

fillData();



/* 
-------------------------------------------------
|                express stuff                  |
-------------------------------------------------
*/

//set views
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.get("/", async (req, res) => {
    // Pass the 'people' array to the 'people.ejs' template
    res.render("db", { personnel: personnel, projects: projects });
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
