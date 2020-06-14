import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import data from './store';
import cors from 'cors';
import connect from './db.js';
import mongo from 'mongodb';
import auth from './auth.js';

const app = express(); // instanciranje aplikacije
const port = 3000; // port na kojem će web server slušati

app.use(cors());
app.use(express.json());

let checkAttributes= (data)=>{
    if (!data.naziv || !data.priprema || !data.vrijeme_pripreme || !data.inputKategorija || !data.slika){
        console.log("provjera atributa");
        return false;
    }
    return true;
};

app.patch('/recepti/:id', async (req, res) => {
  let id = req.params.id;
  let data = req.body;

  delete data._id

  let db = await connect();

  let result = await db.collection("recepti").updateOne({ _id: mongo.ObjectId(id) }, 
                    {
                        $push: { ocjena: parseInt(data.ocjena)}
                    });
  
  

    if (result && result.modifiedCount == 1) {
        let doc = await db.collection("recepti").findOne({ _id: mongo.ObjectId(id)});
        res.json(doc);
    } else {
        res.json({
            status: 'fail',
        });
    }
});

app.get('/tajna', [auth.verify], (req, res) => {
    res.json({ message: 'Ovo je tajna ' + req.jwt.mail });
});

// recepti po id-u
app.get('/recepti/:id', [auth.verify], async (req,res )=> {
    let id= req.params.id;
    let db = await connect();
    
    let doc= await db.collection("recepti").findOne({_id: mongo.ObjectId(id)});
    console.log(doc);
    res.json(doc);
    
});
    
app.get('/recepti', [auth.verify], async (req, res) => {
    let db = await connect();
    let query = req.query;
    console.log(query);
  
    let selekcija = {};
   
    if (query._any) {
      let pretraga = query._any;
      let terms = pretraga.split(' ');
  
      let atributi = ['naziv', 'sastojci' ];
  
      selekcija = {
        $and: [],
      };
  
      terms.forEach((term) => {
        let or = {
          $or: [],
        };
  
        atributi.forEach((atribut) => {
          or.$or.push({ [atribut]: new RegExp(term) });
        });
  
        selekcija.$and.push(or);
      });
    }
  
    console.log('Selekcija', selekcija); 
  
    let cursor = await db.collection('recepti').find(selekcija);
    let results = await cursor.toArray();
    res.json(results);

    // let db = await connect(); // pristup db objektu    
    // let cursor = await db.collection("recepti").find();  
    // let results = await cursor.toArray();
            
    // res.json(results) 
});

//dohvat komentara
app.get('/recepti/:receptId/comments', async (req, res) => {
    let receptId = req.params.receptId;
    let db = await connect();

    let doc = await db.collection('comments').find({receptId: receptId});
    let results = await doc.toArray();
    console.log(results);
    res.json(results);
});





app.get('/users/:username/favoriti',  async (req, res) => {
    let username = req.params.username;
    let db = await connect();

    console.log("povezani smo u favoritima");
    let doc = await db.collection('favoriti').find({'username': username}); 
    
    /* aggregate([{
        $lookup: {
            from: "recepti",
            localField: "receptId",
            foreignField: "_id",
            as: "recepti"
        }
       
    }]) */
    let results= await doc.toArray();
    res.json(results);


}); 










app.get('/recepti/username/:username', [auth.verify], async (req, res) => {
    let username = req.params.username;
    let db = await connect();
    console.log("povezani smo");
     let doc = await db.collection('recepti').find({'username': username});
    let results = await doc.toArray();
    console.log(results);
    res.json(results);

}); 

app.post('/auth', async (req, res) => {
    let user = req.body;

    try {
        let result = await auth.authenticateUser(user.username, user.password);
        res.json(result);
    } catch (e) {
        res.status(401).json({ error: e.message });
    }

});

app.post('/users', async (req, res) => {
    let user = req.body;

    let id;
    try {
        id = await auth.registerUser(user);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }

    res.json({ id: id });
});

app.post('/recepti', [auth.verify], async (req, res) => {
    let data= req.body;
    //postavi vrijeme i datum posta
    //zelimo validan id pa pustamo da ga mongo postavi
    delete data._id;

    let check= checkAttributes(data);
    if(!check){
        res.json({
            status: "fail",
            reason:"incomplete post",
        });
        return 
    }
    
    let db = await connect();

    let result= await db.collection("recepti").insertOne(data);
    

    if(result && result.insertedCount == 1){
        res.json(result.ops[0]);
    }
    else {
        res.json({
            status: "fail",
        });
    }
});

//unos komentara
app.post('/recepti/:receptId/comments', async (req, res) => {
    let db = await connect();
    let doc = req.body;
    
    doc.receptId = req.params.receptId;
    
    let result = await db.collection('comments').insertOne(doc);
    if(result.insertedCount == 1) {
        res.json({
            status: 'success',
            });
    } else {
        res.statusCode = 500;
        res.json({
            status: 'fail',
        });
    }

});

app.post('/users/:username/:receptId/favoriti', async (req, res) => {
    let db = await connect();
    let doc = req.body;

    doc.username = req.params.username;
    doc.receptId = req.params.receptId;

    let result = await db.collection('favoriti').insertOne(doc);
    if(result.insertedCount == 1) {
        res.json({
            status: 'success',
            });
    } else {
        res.statusCode = 500;
        res.json({
            status: 'fail',
        });
    }
})

//brisanje komentara
app.delete('/recepti/:receptId/comments/:commentId', async (req, res) => {
    let db = await connect();
    let commentId = req.params.commentId;

    let result = await db.collection('comments').deleteOne( 
        { _id: mongo.ObjectId(commentId) },
    );

    if(result.deletedCount == 1) {
        res.statusCode = 201;
        res.send();
    } else {
        res.statusCode = 500;
        res.json({
            status: 'fail',
        });
    }
})

app.listen(port, () => console.log(`Slušam na portu ${port}!`));