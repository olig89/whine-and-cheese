const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const MongoClient = require("mongodb").MongoClient;
const ObjectId = require("mongodb").ObjectID;
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const User = require("./models/User.js");
const withAuth = require("./middleware");

const app = express();
const corsOptions = {
  origin: true,
  credentials: true
};

app.use(cors(corsOptions));
app.use(cookieParser());
//app.use(express.static(path.join(__dirname, "/build")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const secret = "mysecretsshhh";
let db;

MongoClient.connect(
  "mongodb://localhost:27017",
  { useNewUrlParser: true },
  (err, client) => {
    if (err) return console.log(err);
    db = client.db("whine");
    app.listen(5000, () => {
      console.log("listening on 5000");
    });
  }
);

const mongo_uri = "mongodb://localhost:27017/react-auth";
mongoose.connect(mongo_uri, function(err) {
  if (err) {
    throw err;
  } else {
    console.log(`Successfully connected to ${mongo_uri}`);
  }
});

app.get("/api/config", withAuth, function(req, res) {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

app.get("/api/checkToken", withAuth, function(req, res) {
  res.sendStatus(200);
});

app.post("/api/register", function(req, res) {
  const { email, password } = req.body;
  const user = new User({ email, password });
  user.save(function(err) {
    if (err) {
      res.status(500).send("Error registering new user please try again.");
    } else {
      res.status(200).send("Welcome to the club!");
    }
  });
});

app.post("/api/authenticate", function(req, res) {
  const { email, password } = req.body;
  User.findOne({ email }, function(err, user) {
    if (err) {
      console.error(err);
      res.status(500).json({
        error: "Internal error please try again"
      });
    } else if (!user) {
      console.log(req);
      res.status(401).json({
        error: "Incorrect email or password"
      });
    } else {
      user.isCorrectPassword(password, function(err, same) {
        if (err) {
          console.error(err);
          res.status(500).json({
            error: "Internal error please try again"
          });
        } else if (!same) {
          console.log("Incorrect email or password");
          res.status(401).json({
            error: "Incorrect email or password"
          });
        } else {
          // Issue token
          const payload = { email };
          const token = jwt.sign(payload, secret, {
            expiresIn: "1h"
          });
          console.log(`User ${email} successfully logged in. Sending cookie.`);
          res.cookie("token", token, {}).sendStatus(200);
        }
      });
    }
  });
});

app.post("/api/logout", function(req, res) {
  console.log(`User ${req.email} successfully logged out.`);
  res.clearCookie("token").sendStatus(200);
});

app.get("/api/checkCode", function(req, res) {
  console.log(`Searching for user with code ${req.query.code}`);
  db.collection("participants")
    .find({ code: req.query.code })
    .toArray((err, result) => {
      if (err) {
        console.error(err);
        res.status(500).json({
          error: "Internal error please try again"
        });
      } else if (result.length === 0) {
        res.status(404).json({
          error: "Incorrect Participant Code"
        });
      } else {
        console.log(`found user ${JSON.stringify(result[0])}`);
        res.status(200).send(result[0]);
      }
    });
});

app.get("/participant_scores", (req, res) => {
  db.collection("scores")
    .aggregate([
      { $match: { participant_id: ObjectId(req.query.id) } },
      {
        $lookup: {
          from: "participants",
          localField: "participant_id",
          foreignField: "_id",
          as: "participant"
        }
      },
      {
        $lookup: {
          from: "wines",
          localField: "wine_id",
          foreignField: "_id",
          as: "wine"
        }
      },
      {
        $lookup: {
          from: "metrics",
          localField: "metric_id",
          foreignField: "_id",
          as: "metric"
        }
      },
      { $sort: { "metric._id": 1 } },
      { $sort: { "wine._id": 1 } },
      {
        $group: {
          _id: {
            participant: { $arrayElemAt: ["$participant", 0] },
            wine: { $arrayElemAt: ["$wine", 0] }
          },
          scores: {
            $push: {
              id: "$_id",
              metric: { $arrayElemAt: ["$metric", 0] },
              value: "$score"
            }
          }
        }
      }
    ])
    .toArray((err, result) => {
      if (err) return console.log(err);
      res.send(result);
    });
});

app.get("/scores", (req, res) => {
  db.collection("scores")
    .find()
    .toArray((err, result) => {
      if (err) return console.log(err);
      res.send(result);
    });
});

app.put("/scores", (req, res) => {
  console.log(`Updating score with id: ${req.body._id}`);
  db.collection("scores").findOneAndUpdate(
    { _id: ObjectId(req.body._id) },
    {
      $set: {
        score: req.body.value
      }
    },
    (err, result) => {
      //if (err) return res.send(err);
      console.log(result);
      res.send(result);
    }
  );
});

app.get("/participants", (req, res) => {
  db.collection("participants")
    .find()
    .toArray((err, result) => {
      if (err) return console.log(err);
      res.send(result);
    });
});

app.post("/participants", async (req, res) => {
  let participantCode;
  let codeValid = false;
  let attempts = 0;
  while (!codeValid) {
    participantCode = generateUserCode();
    let matchingCodes = await db
      .collection("participants")
      .find({ code: participantCode })
      .toArray();
    if (matchingCodes.length === 0) {
      codeValid = true;
    }
    attempts++;
    if (attempts > 5) {
      console.error("Too many attempts");
      return;
    }
  }
  req.body.code = participantCode;
  let participant = await insertItem("participants", req.body);
  let wines = await getCollection("wines");
  let metrics = await getCollection("metrics");
  wines.forEach(wine => {
    metrics.forEach(metric => {
      db.collection("scores").insertOne({
        participant_id: participant.insertedId,
        wine_id: wine._id,
        metric_id: metric._id,
        score: 0
      });
    });
  });
  console.log(`Added participant with id: ${participant.insertedId}`);
  res.send(participant);
});

app.put("/participants", (req, res) => {
  console.log(
    `Updating ${req.body.key} for participant with id: ${req.body._id}`
  );
  db.collection("participants").findOneAndUpdate(
    { _id: ObjectId(req.body._id) },
    {
      $set: {
        [req.body.key]: req.body.value
      }
    },
    (err, result) => {
      if (err) return res.send(err);
      console.log(result);
      res.send(result);
    }
  );
});

app.delete("/participants", (req, res) => {
  console.log(`Deleting participant with id: ${req.body._id}`);
  deleteItem("participants", req.body._id);
  db.collection("scores").deleteMany(
    { participant_id: ObjectId(req.body._id) },
    (err, result) => {
      if (err) return console.log(err);
      res.send(result);
    }
  );
});

app.get("/wines", (req, res) => {
  db.collection("wines")
    .find()
    .toArray((err, result) => {
      if (err) return console.log(err);
      res.send(result);
    });
});

app.post("/wines", async (req, res) => {
  let wine = await insertItem("wines", req.body);
  let participants = await getCollection("participants");
  let metrics = await getCollection("metrics");
  participants.forEach(participant => {
    metrics.forEach(metric => {
      db.collection("scores").insertOne({
        participant_id: participant._id,
        wine_id: wine.insertedId,
        metric_id: metric._id,
        score: 0
      });
    });
  });
  console.log(`Added wine with id: ${wine.insertedId}`);
  res.send(wine);
});

app.put("/wines", (req, res) => {
  console.log(`Updating ${req.body.key} wine with id: ${req.body._id}`);
  db.collection("wines").findOneAndUpdate(
    { _id: ObjectId(req.body._id) },
    {
      $set: {
        [req.body.key]: req.body.value
      }
    },
    (err, result) => {
      if (err) return res.send(err);
      console.log(result);
      res.send(result);
    }
  );
});

app.delete("/wines", (req, res) => {
  console.log(`Deleting wine with id: ${req.body._id}`);
  deleteItem("wines", req.body._id);
  db.collection("scores").deleteMany(
    { wine_id: ObjectId(req.body._id) },
    (err, result) => {
      if (err) return console.log(err);
      console.log(result);
      res.send(result);
    }
  );
});

app.get("/metrics", (req, res) => {
  db.collection("metrics")
    .find()
    .toArray((err, result) => {
      if (err) return console.log(err);
      res.send(result);
    });
});

app.post("/metrics", async (req, res) => {
  let metric = await insertItem("metrics", req.body);
  let participants = await getCollection("participants");
  let wines = await getCollection("wines");
  participants.forEach(participant => {
    wines.forEach(wine => {
      db.collection("scores").insertOne({
        participant_id: participant._id,
        wine_id: wine._id,
        metric_id: metric.insertedId,
        score: 0
      });
    });
  });
  console.log(`Added metric with id: ${metric.insertedId}`);
  res.send(metric);
});

app.put("/metrics", (req, res) => {
  console.log(`Updating ${req.body.key} metric with id: ${req.body._id}`);
  db.collection("metrics").findOneAndUpdate(
    { _id: ObjectId(req.body._id) },
    {
      $set: {
        [req.body.key]: req.body.value
      }
    },
    (err, result) => {
      if (err) return res.send(err);
      console.log(result);
      res.send(result);
    }
  );
});

app.delete("/metrics", (req, res) => {
  console.log(`Deleting metric with id: ${req.body._id}`);
  deleteItem("metrics", req.body._id);
  db.collection("scores").deleteMany(
    { metric_id: ObjectId(req.body._id) },
    (err, result) => {
      if (err) return console.log(err);
      console.log(result);
      res.send(result);
    }
  );
});

getCollection = async collection => {
  return new Promise((resolve, reject) => {
    db.collection(collection)
      .find()
      .toArray((err, result) => {
        if (err) return console.log(err);
        resolve(result);
      });
  });
};

insertItem = async (collection, item) => {
  return new Promise((resolve, reject) => {
    db.collection(collection).insertOne(item, (err, result) => {
      if (err) return console.log(err);
      resolve(result);
    });
  });
};

updateItem = async (collection, id, key, value) => {
  return new Promise((resolve, reject) => {
    db.collection("participants").findOneAndUpdate(
      { _id: ObjectId(id) },
      {
        $set: {
          [key]: value
        }
      },
      (err, result) => {
        if (err) return res.send(err);
        resolve(result);
      }
    );
  });
};

deleteItem = async (collection, id) => {
  return new Promise((resolve, reject) => {
    console.log(`Deleting from ${collection} with id: ${id}`);
    db.collection(collection).findOneAndDelete(
      { _id: ObjectId(id) },
      (err, result) => {
        if (err) return console.log(err);
        console.log(result);
        resolve(result);
      }
    );
  });
};

generateUserCode = () => {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code = `${code}${String.fromCharCode(Math.floor(Math.random() * 26) + 65)}`;
  }
  return code;
};
