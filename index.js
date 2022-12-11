const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const bodyParser = require("body-parser");
const SSLCommerzPayment = require('sslcommerz-lts')
const store_id = 'relia63753f6c95a58'
const store_passwd = 'relia63753f6c95a58@ssl'
const is_live = false //true for live, false for sandbox

require("dotenv").config();

// middleware
app.use(cors());
app.use(express.json());

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.get("/", (req, res) => {
  res.send("Running reliable parts server");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tu9v0.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Invalid authorization" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    const partsCollection = client.db("reliable_parts").collection("parts");
    const orderCollection = client.db("reliable_parts").collection("orders");
    const userCollection = client.db("reliable_parts").collection("users");
    const reviewCollection = client.db("reliable_parts").collection("reviews");
    console.log("mongodb connected");
    // get all parts
    app.get("/part", async (req, res) => {
      const query = {};
      const cursor = partsCollection.find(query);
      const parts = await cursor.toArray();
      res.send(parts);
    });

    //get part detail
    app.get("/part/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const part = await partsCollection.findOne(query);
      res.send(part);
    });
    // post parts 
    app.post("/part", async (req, res) => {
      const parts = req.body;
      const result = await partsCollection.insertOne(parts);
      res.send(result);
    });

    // post order
    app.post("/order", async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      res.send(result);
    });
    // get my all order
    app.get("/order", verifyJWT, async (req, res) => {
      const customer = req.query.customer;
      const decodedEmail = req.decoded.email;
      if (customer === decodedEmail) {
        const query = { customer: customer };
        const order = await orderCollection.find(query).toArray();
        return res.send(order);
      } else {
        return res.status(403).send({ message: "Forbidden access" });
      }
    });
    //post user info
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });


    // get all user
    app.get("/user", verifyJWT, async (req, res) => {
      const query = {};
      const cursor = userCollection.find(query);
      const user = await cursor.toArray();
      res.send(user);
    });
   // get single user
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      res.send(user)
    });

    // put admin access api
    app.put("/user/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        const filter = { email: email };
        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      } else {
        return res.status(403).send({ message: "Forbidden access" });
      }
    });

    // get admin role
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });
    // post review
    app.post("/review", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });
    // get all the reviews
    app.get("/review", async (req, res) => {
      const query = {};
      const cursor = reviewCollection.find(query);
      const review = await cursor.toArray();
      res.send(review);
    });

      // delete product
      app.delete("/part/:id", async(req, res) =>{
        const id = req.params.id;
        const query = {_id: ObjectId(id)};
        const result = await partsCollection.deleteOne(query);
        res.send(result);
    });

        // get all orders
        app.get("/orders", async (req, res) => {
          const query = {};
          const cursor = orderCollection.find(query);
          const orders = await cursor.toArray();
          res.send(orders);
        });
      app.get("/create-session", async (req, res, next) => {
        const data = {
          total_amount: 100,
          currency: 'BDT',
          tran_id: 'REF123',
          success_url: `${process.env.ROOT}/ssl-payment-success`,
          fail_url: `${process.env.ROOT}/ssl-payment-failure`,
          cancel_url: `${process.env.ROOT}/ssl-payment-cancel`,
          ipn_url: `${process.env.ROOT}/ssl-payment-ipn`,
          shipping_method: 'Courier',
          product_name: 'Computer.',
          product_category: 'Electronic',
          product_profile: 'general',
          cus_name: 'Customer Name',
          cus_email: 'cust@yahoo.com',
          cus_add1: 'Dhaka',
          cus_add2: 'Dhaka',
          cus_city: 'Dhaka',
          cus_state: 'Dhaka',
          cus_postcode: '1000',
          cus_country: 'Bangladesh',
          cus_phone: '01711111111',
          cus_fax: '01711111111',
          ship_name: 'Customer Name',
          ship_add1: 'Dhaka',
          ship_add2: 'Dhaka',
          ship_city: 'Dhaka',
          ship_state: 'Dhaka',
          ship_postcode: 1000,
          ship_country: 'Bangladesh',
          multi_card_name: 'mastercard',
          value_a: 'ref001_A',
          value_b: 'ref002_B',
          value_c: 'ref003_C',
          value_d: 'ref004_D'
      };
      const sslcommer = new SSLCommerzPayment(process.env.STORE_ID, process.env.STORE_PASS, false) //true for live default false for sandbox
      sslcommer.init(data).then(data => {
          //process the response that got from sslcommerz 
          //https://developer.sslcommerz.com/doc/v4/#returned-parameters
          console.log("data" , data);
          if (data?.GatewayPageURL) {
            return res.status(200).redirect(data?.GatewayPageURL)
          }
          else{
            return res.status(400).json({
              message: "ssl session was not successful"})
          }
      });
      })
      app.post("/ssl-payment-success", async (req, res, next) => {
        return res.status(200).json({
          data: res.body
        })
      })
      app.post("/ssl-payment-failure", async (req, res, next) => {
        return res.status(400).json({
          data: res.body
        })
      })
      app.post("/ssl-payment-cancel", async (req, res, next) => {
        return res.status(200).json({
          data: res.body
        })
      })
      app.post("/ssl-payment-ipn", async (req, res, next) => {
        return res.status(200).json({
          data: res.body
        })
      })
      // app.listen(process.env.PORT, () => {
      //   console.log(` server is running ${process.env.PORT}`);
      // });
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log("Reliable parts server is running ");
});
