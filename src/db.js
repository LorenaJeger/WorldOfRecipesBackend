import mongo from "mongodb"

let connection_string=
'mongodb+srv://admin:admin@cluster0-gwx0w.mongodb.net/test?retryWrites=true&w=majority';


let client= new mongo.MongoClient(connection_string,{
useNewUrlParser: true,
useUnifiedTopology: true
});

let db= null

export default () => {
return new Promise((resolve, reject) => {

if (db && client.isConnected()) {
resolve(db)
}
else {
client.connect(err=> {
if(err){
reject('Doslo je do greske prilikom spajanja'+err);
}
else {
console.log('uspjesno spajanje na bazu');

db = client.db("worldofrecipes");
resolve(db);
}
});
}
});
}