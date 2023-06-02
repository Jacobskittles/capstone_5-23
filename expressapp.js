//  6/2/2023 run using command `npm run dev` can be found in package.json under scripts
//  Lincoln. initialize express app. nodemon expressapp.js to monitor

//How to connect MongoDB using the web interface: 
// 1. Ensure that you have MongoDB compass installed and mongo initialized in the terminal.
// 2. Open Mongo Atlas online, create your project, cluster, database. 
// 3. Press "Connect" next to your cluster name in the UI. Go to drivers. follow the instructions ensuring you have proper credentials, you may need to reset your password.
// Open MongoDB compass. New Connection. Advanced. Mongodb+srv. Input the same string from before with credentials. 
// Use the code below to connect via express app. You should now be connected to the database in the compass as well as in the app.

//How to connect to MongoDB via command line? 

//  Lincoln's code
const express = require('express')
const app = express()
const path = require('path')
const port = 8088

//  Used to read the user login information and parse it. Gonzales + Lincoln
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));

//  The cookie parser is used to store login information. Gonzales + Lincoln
var cookieParser = require('cookie-parser')
app.use(cookieParser())

//  This is Express middleware that is used to log access to certain pages in the console.
//  Mostly for reference.
function logger(req, res, next){
  console.log(`Received request ... [${Date.now()}] ${req.method} ${req.url}`);
  next();
}
app.use(logger);

//  Express JSON middleware
app.use(express.json())

//This is error handling middleware to catch errors in page requests
function handleErrors(err, req, res, next){
  console.log(err)
  res.status(err.httpStatusCode || 500).send("Oh no, an error occurred!")
}

//  Going to localhost itself will simply redirect to the login screen 
app.get('/', (req, res) => {
  res.redirect('/login')
})

//  Going to the login page will display the HTML.
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/login.html'))
})

//  Going to the projects page. Lincoln + Gonzales
app.get('/projects', (req, res) => {
    //  This code checks to see if credentials are successful and stored as a cookie
  if(req.cookies.login == 'true'){
    res.sendFile(path.join(__dirname, 'views/index.html'))
  }else{
    //  Redirects to login page if the credentials are not successfully stored
    res.redirect('/login')
  }
  
})

app.post('/login', (req, res)=>{
    //  This is a function that exists within the app.post. On submit,
    //  this code will execute. 
    //  Body parser into JSON
    var {username, password} = req.body
    //  Simple code for now to check if login is correct. However, this will change once
    //  we access users in the database.
    if ( username == "admin" && password == "admin123"){
      //  Assign the cookie. Name of 'login' (change name depending on user or admin),
      //  Then boolean true since login was successful.
      res.cookie('login', true)
      //  Take user to projects page after successful login.
      res.redirect('/projects')
      }else{
      //  If credentials are incorrect, redirect to login page.
      res.redirect('/login')
      }
    })

//  Similar to the projects page, this will take you to the projects page.
app.get('/upload', (req, res) => {
  console.log(req.cookies.login)
  if(req.cookies.login == 'true'){
    res.sendFile(path.join(__dirname, 'views/import.html'))
  }else{
    res.redirect('/login')
  }
})

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})

//  Lincoln - This is some code I assembled to connect a web-hosted database to the javascript. 
const { MongoClient, ServerApiVersion } = require('mongodb');
//  Find the uri by connecting your cluster to your node.js. replace with the link found in the instructions on the MongoDB cloud website. Must have proper credentials assigned to the cluster.
//  You can replace with local database host
const uri = "mongodb+srv://ellahlincoln:examplepass@excluster.d8hkgut.mongodb.net/?retryWrites=true&w=majority";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

//  This is a try/catch to ensure that the database connection is successful. 
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);




