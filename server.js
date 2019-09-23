const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const PORT = 4000;
const summonerRoutes = express.Router();
const request = require('request-promise');
const cheerio = require('cheerio');

let Summoner = require('./summoner.model');

app.use(cors());
app.use(bodyParser.json());
app.use('/summoner', summonerRoutes);

//connect to local mongo instance
mongoose.connect('mongodb://127.0.0.1:27017/smurf_score', { useNewUrlParser: true });
const connection = mongoose.connection;

connection.once('open', function() {
  console.log("MongoDB database connection established successfully");
})

//route /summoner/ -> used for testing only
summonerRoutes.route('/').get(function(req, res) {
  Summoner.find(function(err, summoners) {
    if (err) {
      console.log(err);
    } else {
      res.json(summoners);
    }
  });
});

//route /summoner/delete/:id -> again something used in testing, should not have to delete from end user
summonerRoutes.route('/delete/:id').delete(function(req, res) {
  let id = req.params.id;
  Summoner.findByIdAndDelete(id, function(err, summoner) {
    res.json(summoner);
  });
});

//route /search/:name -> this is used to search for a user and add them to the db if they are not already present
summonerRoutes.route('/search/:name').post(function(req, res) {
  let name = req.params.name.split(" ");
  let search_name = name[0];
  Summoner.find( {name: req.params.name.replace(/['"]+/g, '')}, function(err, summoner) {
    if (summoner.length == 0) {
      for(i = 1; i < name.length; i++){
        search_name += `+${name[i]}`;
      }
      const BASE_URL = 'https://na.op.gg/summoner/userName=';
      const USERNAME = search_name.replace(/['"]+/g, '');
      console.log(`${BASE_URL}${USERNAME}`);

      (async () => {
      
        /* Send the request to the user page and get the results */
        let response = await request(`${BASE_URL}${USERNAME}`);

      
        /* Start processing the response */
        let $ = cheerio.load(response);
      
        //summoner info
        let name = $('span.Name').text();
        let smurf_score = null;
        let summoner_level = parseInt($('span.Level.tip').text());
        let tierRank = $('div.TierRank').text().replace(/\s+/g, "");

        //overall wr + games played
        let wins = $('span.wins').text().split('W')[0];
        let losses = $('span.losses').text().split('L')[0];
        let total_games = parseInt(wins) + parseInt(losses);
        let winratio = parseInt($('span.winratio').text().substr(10, 2));
      
        //champion specific info - to be defined by interating through champion box
        let champ_info = [];
      
        $($('div.MostChampionContent').children()).each((i, elm) => {
          champion = $(elm).find('div.ChampionName').attr('title');
        
          //for some reason first champion is duplicated -> skip over first and read the rest
          if(i > 0) {    
            if(typeof champion !== 'undefined' ) {
              champ_info[i - 1] = {
                champion: champion,
                cspm: parseFloat($(elm).find('div.ChampionMinionKill').text().split('(')[1].split(')')[0]),
                kda: parseFloat($(elm).find('span.KDA').text().split(':')[0]),
                win_ratio: parseInt($(elm).find('div.WinRatio').text().replace(/\s+/g, "").split('%')[0]),
                games_played: parseInt($(elm).find('div.Title').text().split(" ")[0])
              }
            }
          }
        });
      
        summoner_info = { name, smurf_score, summoner_level, tierRank, winratio, total_games, champ_info }
        let summoner = new Summoner(JSON.parse(JSON.stringify(summoner_info, null, 4)));
        await summoner.save();
      
        await Summoner.findOne( {name: name}, function(err, summoner) {
          this.id = summoner._id
          //use summoner_level, winratio, total_games, avg kda, avg cspm
          let summoner_level_multiplier = 30/(summoner.summoner_level);
          let avg_kda = 0;
          let avg_cspm = 0;
          let total_games_top_champs = 0;
          for(i = 0; i < summoner.champ_info.length; i++) {
            total_games_top_champs += summoner.champ_info[i].games_played;
          }
          for(i = 0; i < summoner.champ_info.length; i++) {
            avg_kda += (summoner.champ_info[i].kda*(summoner.champ_info[i].games_played/total_games_top_champs) * ((summoner.champ_info[i].win_ratio-50)/15));
            avg_cspm += (summoner.champ_info[i].cspm*(summoner.champ_info[i].games_played/total_games_top_champs) * ((summoner.champ_info[i].win_ratio-50)/15));
          }
          this.smurf_score = summoner_level_multiplier*( (25*((avg_kda-2.5)/2.5)) + (25*((avg_cspm-5.0)/5.0)) + (25*((summoner.winratio-50)/15)) + (25*((100 - summoner.total_games)/50)));
        });
        Summoner.findByIdAndUpdate({ _id: this.id }, { smurf_score: this.smurf_score }, {new: true}, function(err, summoner){
          res.json(summoner);
        });
      })();
    } else {
      res.json(summoner);
    }  
  });
});

app.listen(PORT, function() {
    console.log("Server is running on Port: " + PORT);
});