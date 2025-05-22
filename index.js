import express from "express";
import axios from "axios";
import bodyParser from "body-parser";

const app = express();
const port = process.env.PORT || 3000;
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
const API_KEY = "b1a6e86408c6a3459770a7c9a19ff01d";
const auth = "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiMWE2ZTg2NDA4YzZhMzQ1OTc3MGE3YzlhMTlmZjAxZCIsIm5iZiI6MTc0Nzg1OTk4NC4zMjYwMDAyLCJzdWIiOiI2ODJlM2ExMDY5ZWJlYTk1NTgyZjgyMjQiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.PW-eX51UGgv1858XGpv-9U4KomebSxRTpJkoaim_aL4"
const  headers= {
    accept:"application/json",
    Authorization: auth
};
app.get("/", (req, res) => {
    res.redirect("/home")
})
let page=1;

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
        console.log(ranMovie);
        result = await axios.get("http://www.omdbapi.com/?apikey=cbc861e5&i="+imdbId)
        
        res.render("view-movie.ejs", {movie: ranMovie, director: result.data.Director, actors: result.data.Actors});

    } catch(error) {
        console.log(error.response.data);
        res.status(500);
    }

})

app.get("/home", async (req,res) => {
    try{    
        var result = await axios.get("https://api.themoviedb.org/3/movie/popular?page="+page+"&region=USA",{
            headers: {
                accept:"application/json",
                Authorization: auth
            }
        });
        var popularMovies = result.data.results;
        res.render("index.ejs",{movies: popularMovies,page});

    } catch(error) {
        console.log(error.response.data);
        res.status(500);
    }
    
})

app.get("/previous-page", (req,res) =>{
    if(page==1){
        res.redirect("/home");
    }
    else{
        page--;
        res.redirect("/home");
    }
})

app.get("/previous-previous-page", (req,res) =>{
    if(page==1 && (page-2)<1){
        res.redirect("/home");
    }
    else{
        page-=2;
        res.redirect("/home");
    }
})

app.get("/next-page", (req,res) =>{
    if(page==500){
        res.redirect("/home");
    }
    else{
        page++;
        res.redirect("/home");
    }
})

app.get("/next-next-page", (req,res) =>{
    if(page==500 && (page+2)>500){
        res.redirect("/home");
    }
    else{
        page+=2;
        res.redirect("/home");
    }
})

app.get("/view-movie", async (req,res) => {
    try{    
        var id = req.query.action;
        var result = await axios.get("https://api.themoviedb.org/3/movie/"+id, {
            headers: {
                accept:"application/json",
                Authorization: auth
            }
        });
        var imdbId = result.data["imdb_id"];
        var credits = await axios.get("http://www.omdbapi.com/?apikey=cbc861e5&i="+imdbId)
        res.render("view-movie.ejs", {movie: result.data, director: credits.data.Director, actors: credits.data.Actors});
        
    } catch(error) {
        console.log(error.response.data);
        res.status(500);
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
    console.log(result.data.results.length);
    res.render("search.ejs",{movies: result.data.results, title});

})


app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });