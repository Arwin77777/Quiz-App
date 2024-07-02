const express = require('express');
const bcrypt = require('bcryptjs')
const cors = require('cors');
const jwt = require('jsonwebtoken');
const createUser = require('./models/user');
const { client, docClient } = require('./db');
const { ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const Quiz = require('./models/quiz');
const { createServer } = require('dynamodb-admin');
const { v4: uuidv4 } = require('uuid');
const dynamodb = require('./contoller');
const { generateOtp, sendEmail } = require('./services/handlePassword');
const uniqueId = uuidv4();
const moment = require('moment');

const app = express();
app.use(cors());
app.use(express.json());

const adminApp = createServer(client, docClient);
let onetimepassword;

const host = 'localhost';
const port = 8002;
const server = adminApp.listen(port, host);
server.on('listening', () => {
  const address = server.address();
  console.log(`Listening on http://${address.address}:${address.port}`);
});
createUser().catch(err => console.log("error", err));
Quiz().catch(err => console.log("error", err));



app.get("/getUser", async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, "qwerty123");
  const userId = decoded.userId;
  if (!userId) {
    return res.status(500).json("Unauthorized");
  }
  console.log(decoded.email);
  const response = await dynamodb.getItem("Users", { email: decoded.email });
  try {
    if (response)
      return res.status(200).json({ message: response });
    else
      return res.status(404).json({ error: "User not found" });
  }
  catch (error) {
    console.log(error);
    return res.status(500).send("Internal Error");
  }

})



app.get('/getAllUsers', async (req, res) => {
  try {
    const params = {
      TableName: 'Users'
    };
    const command = new ScanCommand(params);
    const data = await docClient.send(command);
    return res.status(200).json(data.Items);
  } catch (err) {
    console.error("Error", err);
    return res.status(500).json({ error: "Error fetching items" });
  }
});


app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const FilterExpression = "email=:email";
  const ExpressionAttributeValues = { ":email": email };


  const response = await dynamodb.scanItems('Users', FilterExpression, ExpressionAttributeValues,);

  try {
    if (response.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const user = response[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.userId, email: user.email, role: user.role }, "qwerty123", { expiresIn: '1h' });
    res.status(200).json({ token });
  }
  catch (err) {
    console.log(err);
    res.status(500).send("Internal server error");
  }
})


app.post('/signup', async (req, res) => {
  const { email, password, role, userName } = req.body;

  const response = await dynamodb.scanItems("Users", "email=:email", { ":email": email },);

  try {
    if (response.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }
  } catch (error) {
    console.error('Error checking user existence:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }

  // const updatedBy = email;
  const userId = uuidv4();
  const hashedPassword = await bcrypt.hash(password, 10);
  const quizAttempted = [];
  const items = {
    userId,
    email,
    password: hashedPassword,
    role,
    userName,
    quizAttempted,
    updatedBy:"",
    updatedAt:"",
  }

  try {
    const response = await dynamodb.addItem("Users", items);
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



/////get all the quizzes
app.get('/getAllQuizzes', async (req, res) => {
  try {
    const response = await dynamodb.scanItems('Quiz');
    return res.status(200).json(response);
  }
  catch (error) {
    console.log(error);
    return res.status(500).send("Internal server error");
  }
})

app.post('/addQuiz', async (req, res) => {
  const { category, quizName, quizImage, questions } = req.body;

  const quizId = uuidv4();
  const questionsWithIds = questions.map(question => ({
    questionId: uuidv4(),
    ...question
  }));

  //  const token = auth.getToken(req);
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, "qwerty123");
  if (!token || !decoded.role === "admin") {
    return res.status(500).json("Unauthorized");
  }
  const creatorId = decoded.userId;


  const Item = {
    quizId,
    category,
    quizName,
    quizImage,
    questions: questionsWithIds,
    creatorId
  }

  try {
    const data = await dynamodb.addItem("Quiz", Item);
    return res.status(200).json({ message: 'Quiz created successfully' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Failed to create quiz' });
  }
});



//get quiz by id

app.get("/getQuiz/:quizId", async (req, res) => {
  const quizId = req.params.quizId;

  const key = { quizId: quizId };
  try {
    const response = await dynamodb.getItem("Quiz", key);
    if (response) {
      return res.status(200).json(response);
    }
  }
  catch (err) {
    return res.status(404).json("Quiz Not found");
  }

})


app.put('/changePassword', async (req, res) => {
  const { email, password, otp } = req.body;
  try {
    console.log(otp, "======", onetimepassword)
    if (onetimepassword !== Number(otp)) {
      res.status(401).json("Invalid Otp");
    }
    let KeyConditionExpression = "email = :value";
    let ExpressionAttributeValues = {
      ":value": email,
    };

    let response1 = await dynamodb.queryItems(
      "Users",
      KeyConditionExpression,
      ExpressionAttributeValues,
      "userId"
    );

    if (response1.length === 0) {
      res.status(404).json("User not found");
    } else {
      try {
        let hash = await bcrypt.hash(password, 10);
        await dynamodb.updateItem("Users", { email: email }, { password: hash }, 'attribute_exists(email)');
        res.status(200).json("Password Updated");
      } catch (error) {
        return res.status(500).json({});
      }
    }
  } catch (error) {
    return res.status(500).json("Internal server error");
  }

})

app.get('/email/:email', async (req, res) => {
  const email = req.params.email;
  try {
    let KeyConditionExpression = "email = :value";
    let ExpressionAttributeValues = {
      ":value": email,
    };
    let response = await dynamodb.queryItems(
      "Users",
      KeyConditionExpression,
      ExpressionAttributeValues,
      "userId"
    );
    if (response.length === 0) {
      return res.status(404).json("User not found");
    } else {
      onetimepassword = generateOtp();
      let response = await sendEmail(email, onetimepassword);
      if (response) {
        return res.status(200).json("Otp sent");
      } else {
        return res.status(500).json("Internal server error");
      }
    }
  } catch (error) {
    return error;
  }
})


app.put('/editUser', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, "qwerty123");
    const userId = decoded.userId;
    const { email, password, ...data } = req.body;
    const key = { email: email };

    const response = await dynamodb.updateItem("Users", key, data, "attribute_exists(email)");
    if (response)
      return res.status(200).json(response.Attributes);
  } catch (error) {
    console.error("Error updating user", error);
  }
});


app.put('/editQuiz/:quizId', async (req, res) => {
  const quizId = req.params.quizId;

  const token = req.headers.authorization?.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, "qwerty123");
    if (!token || decoded.role !== 'admin') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { ...data } = req.body;

  const key = { quizId: quizId };
  try {
    const response = await dynamodb.updateItem("Quiz", key, data,)
    console.log('Quiz updated successfully:', response.Attributes);
    return res.status(200).json({ message: 'Quiz updated successfully', quiz: response.Attributes });
  } catch (error) {
    console.error('Error updating quiz:', error);
    return res.status(500).json({ error: 'Failed to update quiz' });
  }
});



app.delete("/deleteQuiz/:quizId", async (req, res) => {
  const quizId = req.params.quizId;
  const token = req.headers.authorization?.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, "qwerty123");
    if (!token || decoded.role !== 'admin') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const FilterExpression = 'quizId=:quizId';
  const ExpressionAttributeValues = { ":quizId": quizId };
  const key = { quizId: quizId };
  const resp = await dynamodb.scanItems("Quiz", FilterExpression, ExpressionAttributeValues,)
  if (resp.length === 0) {
    return res.status(404).json({ Message: "No such element found" });
  }
  const response = await dynamodb.deleteItem("Quiz", key);
  console.log('Quiz deleted successfully:', response);
  if (response)
    return res.status(200).json({ message: 'Quiz deleted successfully' });
})

//add a question to a quiz
app.post("/quiz/:quizId/addQuestion", async (req, res) => {
  const { ...data } = req.body;

  const quizId = req.params.quizId;


  const FilterExpression = 'quizId=:quizId';
  const ExpressionAttributeValues = { ":quizId": quizId };
  const key = { quizId: quizId };
  const resp = await dynamodb.scanItems("Quiz", FilterExpression, ExpressionAttributeValues,)
  if (resp.length === 0) {
    return res.status(404).json({ Message: "No such element found" });
  }
  const questionId = uuidv4();
  resp[0].questions.push({ questionId, ...data });
  await dynamodb.addItem("Quiz", resp[0]);
  console.log(resp[0]);
  return res.status(200).json({ message: "Question added successfully" });
})

//update a particular question of a quiz
app.put("/quiz/:quizId/editQuestion/:questionId", async (req, res) => {
  const quizId = req.params.quizId;
  const questionId = req.params.questionId;
  const updatedQuestion = req.body;
  updatedQuestion.questionId = questionId;

  const token = req.headers.authorization?.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, "qwerty123");
    if (!token || decoded.role !== 'admin') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(401).json({ message: 'Unauthorized' });
  }




  try {
    const data = await dynamodb.getItem("Quiz", { quizId: quizId });
    if (data) {

      const questions = data.questions;
      const questionIndex = questions.findIndex(q => q.questionId === questionId);

      if (questionIndex !== -1) {
        questions[questionIndex] = { ...questions[questionIndex], ...updatedQuestion };


      } else {
        console.error('Question not found');
        res.status(404).json({ error: "Question not found" });;
      }
      console.log("-------------------->", questions)
      const updateParams = new UpdateCommand({
        TableName: 'Quiz',
        Key: {
          quizId: quizId
        },
        UpdateExpression: 'set questions = :questions',
        ExpressionAttributeValues: {
          ':questions': questions,
        }
      });

      await docClient.send(updateParams);
      console.log('Question updated successfully');
      return res.status(200).json({ message: "Question updated successfully" });
    } else {
      console.error('Quiz not found');
      res.status(404).json({ error: "Quiz not found" });
    }
  } catch (error) {
    console.error('Error updating question:', error);
    return res.status(400).status({ error: "Error updating the question" })
  }
});


//delete a particular question of a quiz
app.delete("/quiz/:quizId/deleteQuestion/:questionId", async (req, res) => {
  const quizId = req.params.quizId;
  const questionId = req.params.questionId;

  const token = req.headers.authorization?.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, "qwerty123");
    if (!token || decoded.role !== 'admin') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(401).json({ message: 'Unauthorized' });
  }


  try {
    const data = await dynamodb.getItem("Quiz", { quizId: quizId });
    if (data) {

      const questions = data.questions;
      const questionIndex = questions.findIndex(q => q.questionId === questionId);

      if (questionIndex !== -1) {
        questions.splice(questionIndex, 1);
      } else {
        console.error('Question not found');
        res.status(404).json({ error: "Question not found" });
      }

      const updateParams = new UpdateCommand({
        TableName: 'Quiz',
        Key: {
          quizId: quizId
        },
        UpdateExpression: 'SET questions = :questions',
        ExpressionAttributeValues: {
          ':questions': questions,
        }
      });

      await docClient.send(updateParams);
      console.log('Question deleted successfully');
      return res.status(200).json({ message: "Question deleted" });
    }
  }
  catch (error) {
    console.error('Quiz not found');
    res.status(404).json({ error: "Quiz not found" });
  }
})

let dateObject = new Date();


app.post('/participate/:quizId', async (req, res) => {
  const quizId = req.params.quizId;
  // const email = req.body.email;
  const { email, score ,rating,feedback } = req.body;

  const FilterExpression = 'email=:email';
  const ExpressionAttributeValues = { ":email": email };
  const key = { quizId: quizId };
  const resp = await dynamodb.scanItems("Users", FilterExpression, ExpressionAttributeValues,)
  if (resp.length === 0) {
    return res.status(404).json({ Message: "No such user found" });
  }
  const questionId = uuidv4();
  let date = ("0" + dateObject.getDate()).slice(-2);
  let month = ("0" + (dateObject.getMonth() + 1)).slice(-2);
  let year = dateObject.getFullYear();
  let hours = dateObject.getHours();
  let minutes = dateObject.getMinutes();
  let seconds = dateObject.getSeconds();
  const time = year + "-" + month + "-" + date + " " + hours + ":" + minutes + ":" + seconds;
  resp[0].quizAttempted?.push({ time, score ,quizId ,feedback,rating});
  await dynamodb.addItem("Users", resp[0]);
  console.log(resp[0]);
  return res.status(200).json({ message: "Score added successfully" });

})


app.listen(3000, () => {
  console.log('Example app listening at http://localhost:3000');
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});
