import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import { Strategy } from "passport-local";
import env from "dotenv";
env.config();
const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();
const app = express();
const saltRounds = 10;
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());
const port = process.env.PORT || 3000;
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
const API_KEY = "b1a6e86408c6a3459770a7c9a19ff01d";
const auth = "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiMWE2ZTg2NDA4YzZhMzQ1OTc3MGE3YzlhMTlmZjAxZCIsIm5iZiI6MTc0Nzg1OTk4NC4zMjYwMDAyLCJzdWIiOiI2ODJlM2ExMDY5ZWJlYTk1NTgyZjgyMjQiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.PW-eX51UGgv1858XGpv-9U4KomebSxRTpJkoaim_aL4"
const  headers= {
    accept:"application/json",
    Authorization: auth
};

let page=1;
let currentEmail;
let currentName;
app.get("/", (req, res) => {
    res.render("intro.ejs");
})

app.get("/login", (req, res) => {
    res.render("login.ejs");
})

app.get("/register", (req, res) => {
    res.render("register.ejs");
})


app.post("/register", async (req, res) => {
    const email = req.body.username;
    const password = req.body.password;
    try{
        const check = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if(check.rows.length > 0) {
            res.redirect("/login");
        }
        else{
            bcrypt.hash(password, saltRounds, async (err, hash) => {
                if(err){
                    console.log(err);
                }
                else{
                    const result = await db.query("INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",[email, hash]);
                    currentEmail = email;
                    const user = result.rows[0];
                    currentName= "User";
                    req.login(user, (err) =>{
                        console.log("success");
                        res.redirect("/home");
                    })
                }
            })
        }
    } catch (err) {
        console.log(err);
    }


})


app.post("/watchlist", async (req, res) => {
    const action = req.query.action;
    const id = req.query.id;
    const imdbId = req.query.imdbId;
    if(action == "remove"){
        await db.query("UPDATE users SET watchlist = array_remove(watchlist, $1) WHERE email = $2",[imdbId, currentEmail]);
    }
    else{
        await db.query("UPDATE users SET watchlist = watchlist || ARRAY[$1] WHERE email = $2",[imdbId, currentEmail]);
    }
    res.redirect("/view-movie?action="+id)
})


app.get("/watchlist", async (req, res) => {
    var result = await db.query("SELECT * FROM users WHERE email = $1",[currentEmail]);
    result = result.rows[0].watchlist;
    var watchlist=[];
    if(result != null){
        for(var i=0; i<result.length;i++){
            if(result[i] != null || result[i] != undefined || result[i] != ""){
                var temp = await axios.get("https://api.themoviedb.org/3/find/"+result[i]+"?external_source=imdb_id",{
                    headers: {
                        accept:"application/json",
                        Authorization: auth
                    }
                });
                temp = temp.data.movie_results[0];
                watchlist.push(temp);
            }
        }
    }
    //console.log(watchlist);
    res.render("watchlist.ejs",{ movies: watchlist, header: currentName+"'s Watchlist"})
})


app.post("/review", async (req, res) => {
    var temp = await axios.get("https://api.themoviedb.org/3/find/"+req.query.imdbId+"?external_source=imdb_id",{
        headers: {
            accept:"application/json",
            Authorization: auth
        }
    });
    var movie = temp.data.movie_results[0];
    var result = await axios.get("http://www.omdbapi.com/?apikey=cbc861e5&i="+req.query.imdbId);
    var userId = await db.query("SELECT * FROM users WHERE email = $1",[currentEmail]);
    userId=userId.rows[0].id;
    var check = await db.query("SELECT * FROM watched_movies WHERE user_id = $1 AND movie_id = $2",[userId, movie.id]);
    var rating;
    var review;
    if(check.rows.length > 0){
        rating = check.rows[0].movie_rating;
        review = check.rows[0].movie_review;
    }
    res.render("review.ejs", {movie, director: result.data.Director, actors: result.data.Actors, rating, review});
})

app.post("/edit", async (req, res) => {
    const rating = req.body.rating;
    const review = req.body.review;
    var userId = await db.query("SELECT * FROM users WHERE email = $1",[currentEmail]);
    userId=userId.rows[0].id;
    try{
        await db.query("INSERT INTO watched_movies (movie_id, movie_review, movie_rating, user_id) VALUES ($1, $2, $3, $4)",[req.query.id, review, rating, userId]);
    } catch(err){
        console.log(err);
    }
    var imdbId = await axios.get("https://api.themoviedb.org/3/movie/"+req.query.id+"?language=en-US", {
        headers: {
            accept:"application/json",
            Authorization: auth
        }
    });
    imdbId = imdbId.data.imdb_id;
    await db.query("UPDATE users SET watchlist = array_remove(watchlist, $1) WHERE email = $2",[imdbId, currentEmail]);
    res.redirect("/review");
})


app.get("/review", async (req, res) => {
    var userId = await db.query("SELECT * FROM users WHERE email = $1",[currentEmail]);
    userId=userId.rows[0].id;
    var result = await db.query("SELECT * FROM watched_movies WHERE user_id = $1",[userId]);
    result = result.rows;
    var movies=[];
    if(result!=null){
        for(var i=0;i<result.length;i++){
            var temp = await axios.get("https://api.themoviedb.org/3/movie/"+result[i].movie_id+"?language=en-US",{
                headers: {
                    accept:"application/json",
                    Authorization: auth
                }
            });
            temp = temp.data;
            movies.push(temp);
        }
    }
    res.render("rev-list.ejs",{movies, header: currentName+"'s Reviews"});
})

app.post("/delete", async (req, res) => {
    var userId = await db.query("SELECT * FROM users WHERE email = $1",[currentEmail]);
    userId=userId.rows[0].id;
    await db.query("DELETE FROM watched_movies WHERE user_id = $1 AND movie_id = $2",[userId, req.query.id]);
    res.redirect("/review");
})

app.post("/random", async (req, res) => {
    try{
        var ranPage = Math.floor((Math.random()*300)+1);
        var result = await axios.get("https://api.themoviedb.org/3/movie/popular?page="+ranPage+"&region=USA",{
            headers: {
                accept:"application/json",
                Authorization: auth
            }
        });
        var ranMovie= result.data.results[Math.floor(Math.random()*20)];
        var ranMovieId = ranMovie["id"];
        result = await axios.get("https://api.themoviedb.org/3/movie/"+ranMovieId, {
            headers: {
                accept:"application/json",
                Authorization: auth
            }
        });
        var imdbId = result.data["imdb_id"];
        ranMovie= result.data;
        result = await axios.get("http://www.omdbapi.com/?apikey=cbc861e5&i="+imdbId);
        console.log(currentEmail);
        var watchlist = await db.query("SELECT * FROM users WHERE email = $1",[currentEmail]);
        watchlist = watchlist.rows[0].watchlist;
        var wButton=true;
        for(var i=0; i<watchlist.length;i++) {
            if(watchlist[i] == imdbId){
                wButton=false;
                break;
            }
        }

        var rButton = true;
        var userId = await db.query("SELECT * FROM users WHERE email = $1",[currentEmail]);
        userId=userId.rows[0].id;
        var check = await db.query("SELECT * FROM watched_movies WHERE user_id = $1 AND movie_id=$2", [userId, result.data.id]);
        if(check.rows.length > 0){
            rButton = false;
        }
        res.render("view-movie.ejs", {movie: ranMovie, director: result.data.Director, actors: result.data.Actors, watchlist: wButton, reviewed: rButton});

    } catch(error) {
        console.log(error.response.data);
        res.status(500);
    }

})

passport.use("local", new Strategy(async function verify(username, password, cb) {
    try{
        const result = await db.query("SELECT * FROM users WHERE email = $1", [username]);
        if(result.rows.length > 0){
            const user = result.rows[0];
            const storedHashedPassword = user.password;
            bcrypt.compare(password, storedHashedPassword, (err, valid) => {
                if(err){
                    console.log(err);
                }
                else{
                    if(valid){
                        currentName = "User";
                        currentEmail = username;
                        return cb(null, user);
                    }
                    else{
                        return cb(null, false);
                    }
                }
            })
        }
        else{
            return cb("User not found")
        }

    } catch(err){
        console.log(err);
    }
}))

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/home",
    failureRedirect: "/login",
  })
);


app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get("/auth/google/home", passport.authenticate("google", {
    successRedirect: "/home",
    failureRedirect: "/login",
  })
);

app.get("/logout", (req, res) => {
    req.logout(function (err) {
      if (err) {
        return next(err);
      }
      res.redirect("/");
    });
  });
  
passport.use("google", new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/home",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    }, async (accessToken, refreshToken, profile, cb) => {
        try{
            currentEmail= profile.emails[0].value;
            currentName=profile.given_name;
            const result = await db.query("SELECT * FROM users WHERE email = $1", [profile.email]);
            if(result.rows.length == 0){
                const newUser = await db.query("INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",[profile.email, "google"]);
                currentName = profile.given_name;
                return cb(null, newUser.rows[0]);
            } 
            else{
                return cb(null, result.rows[0]);
            }
        } catch(err) {
            return cb(err);
        }
    }
))

app.get("/home", async (req,res) => {
    if(req.isAuthenticated()){
        try{    
            var result = await axios.get("https://api.themoviedb.org/3/movie/popular?page="+page+"&region=USA",{
                headers: {
                    accept:"application/json",
                    Authorization: auth
                }
            });
            var popularMovies = result.data.results;
            
            res.render("index.ejs",{movies: popularMovies,page,currentName});

        } catch(error) {
            console.log(error.response.data);
            res.status(500);
        }
    }
    else{
        res.redirect("/")
    }   
    
})

app.get("/previous-page", (req,res) =>{
    if(req.isAuthenticated()){
        if(page==1){
            res.redirect("/home");
        }
        else{
            page--;
            res.redirect("/home");
        }
    }
    else{
        res.redirect("/")
    }
})

app.get("/previous-previous-page", (req,res) =>{
    if(req.isAuthenticated()){
        if(page==1 && (page-2)<1){
            res.redirect("/home");
        }
        else{
            page-=2;
            res.redirect("/home");
        }
    }
    else{
        res.redirect("/")
    }
})

app.get("/next-page", (req,res) =>{
    if(req.isAuthenticated()){
        if(page==500){
            res.redirect("/home");
        }
        else{
            page++;
            res.redirect("/home");
        }
    }
    else{
        res.redirect("/")
    }
})

app.get("/next-next-page", (req,res) =>{
    if(req.isAuthenticated()){
        if(page==500 && (page+2)>500){
            res.redirect("/home");
        }
        else{
            page+=2;
            res.redirect("/home");
        }
    }
    else{
        res.redirect("/");
    }
})

app.get("/view-movie", async (req,res) => {
    if(req.isAuthenticated()){
        try{    
            var id = req.query.action;
            var result = await axios.get("https://api.themoviedb.org/3/movie/"+id, {
                headers: {
                    accept:"application/json",
                    Authorization: auth
                }
            });
            var imdbId = result.data["imdb_id"];
            var credits = await axios.get("http://www.omdbapi.com/?apikey=cbc861e5&i="+imdbId);
            
            var watchlist = await db.query("SELECT * FROM users WHERE email = $1",[currentEmail]);
            watchlist = watchlist.rows[0].watchlist;
            var wButton=true;
            if(watchlist != null){
                for(var i=0; i<watchlist.length;i++) {
                    if(watchlist[i] == imdbId){
                        wButton=false;
                        break;
                    }
                }
            }
            var rButton = true;
            var userId = await db.query("SELECT * FROM users WHERE email = $1",[currentEmail]);
            userId=userId.rows[0].id;
            var check = await db.query("SELECT * FROM watched_movies WHERE user_id = $1 AND movie_id=$2", [userId, result.data.id]);
            if(check.rows.length > 0){
                rButton = false;
            }
            res.render("view-movie.ejs", {movie: result.data, director: credits.data.Director, actors: credits.data.Actors, watchlist: wButton, reviewed: rButton});
            
        } catch(error) {
            console.log(error.response.data);
            res.status(500);
        }
    }
    else{
        res.redirect("/")
    }
})

app.post("/search", async (req,res) =>{
    var title = req.body.title;
    var result = await axios.get("https://api.themoviedb.org/3/search/movie?query="+title, {
        headers: {
            accept:"application/json",
            Authorization: auth
        }
    });
    var movies = [];
    for(var i=0; i<result.data.results.length;i++){
        if(result.data.results[i].poster_path != null){
            movies.push(result.data.results[i]);
        }
    }
    res.render("search.ejs",{movies, title});

})

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });