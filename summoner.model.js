const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let Summoner = new Schema({
  name: {
    type: String
  },
  smurf_score: {
    type: Number
  },
  summoner_level: {
    type: Number
  },
  tierRank: {
    type: String
  },
  winratio: {
    type: Number
  },
  total_games: {
    type: Number
  },
  champ_info: [
    { 
      champion: String,
      cspm: Number,
      kda: Number,
      win_ratio: Number,
      games_played: Number
    }
  ]

});

module.exports = mongoose.model('Summoner', Summoner);