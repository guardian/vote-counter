const fs = require('fs');
const readline = require('readline');
const fetch = require('node-fetch');
const _ = require('lodash');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter one or multiple division ids, separated by commas: \n', (answer) => {
  const divisions = answer.split(',').map(str => str.trim());

  if (divisions.some(isNaN) || divisions.length < 1) {
    console.log("Invalid input. Please run the script again with 'npm run fetch'");
    rl.close();
  } else {
    console.log('Fetching division(s) info...');

    const urls = divisions.map(division => `https://commonsvotes-services.digiminster.com/data/division/${division}.json`) //new api
    // get all members info. Uses the old api.
    fetch('http://data.parliament.uk/membersdataplatform/services/mnis/members/query/House=Commons%7CIsEligible=true/',
      {
        method: 'GET', headers: { 'Content-Type': 'application/json' }
      })
      .then(res => res.text())
      .then(text => JSON.parse(text.trim()))
      .then(json => {

        const final = {
          divisionsInfo: [],
          membersInfo: []
        }

        const allMembers = json['Members']['Member'].map(member => {
          return {
            id: member['@Member_Id'],
            name: member['DisplayAs'],
            listAs: member['ListAs'],
            party: member['Party']['#text'].startsWith('Labour') ? 'Labour' : member['Party']['#text'],
            partyId: member['Party']['@Id'],
            constituency: member['MemberFrom'],
            gender: member.Gender,
            votes: []
          }
        })

        // get division(s) voting info
        Promise.all(urls.map(url =>
          fetch(url).then(res => res.json())
        )).then(jsons => {
          jsons.forEach(res => {
            const ayeVoters = res['Ayes'];
            const noVoters = res['Noes'];
            const ayeTellers = res['AyeTellers'];
            const noTellers = res['NoTellers'];
            const voteTitle = res['Title'];
            const divisionNumber = res['Number'];

            const divisionRecap = {
              title: voteTitle,
              number: divisionNumber,
              date: res['Date'],
              ayesCount: res['AyeCount'],
              noesCount: res['NoCount'],
              abstainCount: allMembers.length - ayeVoters.length - noVoters.length,
            }

            // let vote;
            // let isTeller;

            final.divisionsInfo.push(divisionRecap);

            allMembers.forEach(member => {
              let vote
              let isTeller
              
              if (ayeVoters.find(voter => Number(member.id) === voter['MemberId'])) {
                vote = 'AyeVote'
                isTeller = false
              } else if (noVoters.find(voter => Number(member.id) === voter['MemberId'])) {
                vote = 'NoVote'
                isTeller = false
              } else if (ayeTellers.find(voter => Number(member.id) === voter['MemberId'])) {
                vote = 'AyeVote'
                isTeller = true
              } else if (noTellers.find(voter => Number(member.id) === voter['MemberId'])) {
                vote = 'NoVote'
                isTeller = true
              } else {
                vote = 'A'
                isTeller = false
              }

              member.votes.push({
                voteTitle,
                divisionNumber,
                vote,
                teller: isTeller
              })
            })
          })

          final.membersInfo = allMembers;

          return final;

        }).then(final => {
          fs.writeFileSync(`./votesNew.json`, JSON.stringify(final));
        }).catch(e => console.log('Something went wrong fetching the data. Make sure you have entered valid divisions ids.'))
      })

    rl.close();
  }
});
