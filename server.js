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
        let tier_rank = $('div.TierRank').text().replace(/\s+/g, "");

        //overall wr + games played
        let wins = $('span.wins').text().split('W')[0];
        let losses = $('span.losses').text().split('L')[0];
        let total_games = parseInt(wins) + parseInt(losses);
        let overall_win_ratio = parseInt($('span.winratio').text().substr(10, 2));
      
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


        /*update smurf_score now that we have a record
        use summoner_level, overall_win_ratio, total_games, avg kda, avg cspm
        future iterations -> adjustable avgs to weight around -> change by division*/
        let avg_kda = 0;
        let avg_cspm = 0;
        let total_games_top_champs = 0;

        /*set summoner_level_multiplier -> idea here is that the farther away from 30
        they are the smaller this number becomes, thus the higher level players
        will tend towards zero as it is unlikely they are smurfs*/
        let summoner_level_multiplier = 30/(summoner_level);
        
        //get total games played on top champs
        for(i = 0; i < champ_info.length; i++) {
          total_games_top_champs += champ_info[i].games_played;
        }

        /*use top champs performance to weight each category - if someone is a one trick
        their performance on their top champ should matter more than one they only played one
        ranked game on*/
        for(i = 0; i < champ_info.length; i++) {
          avg_kda += (champ_info[i].kda*(champ_info[i].games_played/total_games_top_champs) * ((champ_info[i].win_ratio-50)/10));
          avg_cspm += (champ_info[i].cspm*(champ_info[i].games_played/total_games_top_champs) * ((champ_info[i].win_ratio-50)/10));
        }

        /*early version of smurf_score, weighted around the 'averages' this should give a score above 20 if the person is suspicious
        with most normal players going negative - especially players that played a lot of games this season or those with high levels*/
        smurf_score = summoner_level_multiplier*( (25*((avg_kda-2.5)/2.5)) + (25*((avg_cspm-5.0)/5.0)) + (25*((overall_win_ratio-50)/10)) + (25*((100 - total_games)/50)));
        
      
        summoner_info = { name, smurf_score, summoner_level, tier_rank, overall_win_ratio, total_games, champ_info }
        let summoner = new Summoner(JSON.parse(JSON.stringify(summoner_info, null, 4)));
        summoner.save()
                .then(summoner => {
                  res.status(200).json(summoner);
                })
                .catch(err => {
                  res.status(400).send('adding new summoner failed')
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