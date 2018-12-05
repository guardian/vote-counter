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
              id: res['DivisionId'],
              date: res['Date'],
              ayesCount: res['AyeCount'] + ayeTellers.length,
              noesCount: res['NoCount'] + noTellers.length,
              abstainCount: allMembers.length - ayeVoters.length - noVoters.length -ayeTellers.length - noTellers.length,
              ayesByParty: [
                { party: 'Labour', votes: ayeVoters.filter(d => d['Party'] === 'Labour' || d['Party'] === 'Labour (Co-op)').length + ayeTellers.filter(d => d['Party'] === 'Labour').length},
                {party: 'Conservative', votes: ayeVoters.filter(d => d['Party'] === 'Conservative').length + ayeTellers.filter(d => d['Party'] === 'Conservative').length},
                {party: 'Scottish National Party', votes: ayeVoters.filter(d => d['Party'] === 'Scottish National Party').length + ayeTellers.filter(d => d['Party'] === 'Scottish National Party').length},
                {party: 'Liberal Democrat', votes: ayeVoters.filter(d => d['Party'] === 'Liberal Democrat').length + ayeTellers.filter(d => d['Party'] === 'Liberal Democrat').length},
                {party: 'Sinn Féin', votes: ayeVoters.filter(d => d['Party'] === 'Sinn Féin').length + ayeTellers.filter(d => d['Party'] === 'Sinn Féin').length},
                {party: 'Plaid Cymru', votes: ayeVoters.filter(d => d['Party'] === 'Plaid Cymru').length + ayeTellers.filter(d => d['Party'] === 'Plaid Cymru').length},
                {party: 'Democratic Unionist Party', votes: ayeVoters.filter(d => d['Party'] === 'Democratic Unionist Party').length + ayeTellers.filter(d => d['Party'] === 'Democratic Unionist Party').length},
                {party: 'Green Party', votes: ayeVoters.filter(d => d['Party'] === 'Green Party').length + ayeTellers.filter(d => d['Party'] === 'Green Party').length},
                {party: 'Independent', votes: ayeVoters.filter(d => d['Party'] === 'Independent').length + ayeTellers.filter(d => d['Party'] === 'Independent').length}
              ],
              noesByParty: [
                { party: 'Labour', votes: noVoters.filter(d => d['Party'] === 'Labour' || d['Party'] === 'Labour (Co-op)').length + noTellers.filter(d => d['Party'] === 'Labour').length},
                {party: 'Conservative', votes: noVoters.filter(d => d['Party'] === 'Conservative').length + noTellers.filter(d => d['Party'] === 'Conservative').length},
                {party: 'Scottish National Party', votes: noVoters.filter(d => d['Party'] === 'Scottish National Party').length + noTellers.filter(d => d['Party'] === 'Scottish National Party').length},
                {party: 'Liberal Democrat', votes: noVoters.filter(d => d['Party'] === 'Liberal Democrat').length + noTellers.filter(d => d['Party'] === 'Liberal Democrat').length},
                {party: 'Sinn Féin', votes: noVoters.filter(d => d['Party'] === 'Sinn Féin').length + noTellers.filter(d => d['Party'] === 'Sinn Féin').length},
                {party: 'Plaid Cymru', votes: noVoters.filter(d => d['Party'] === 'Plaid Cymru').length + noTellers.filter(d => d['Party'] === 'Plaid Cymru').length},
                {party: 'Democratic Unionist Party', votes: noVoters.filter(d => d['Party'] === 'Democratic Unionist Party').length + noTellers.filter(d => d['Party'] === 'Democratic Unionist Party').length},
                {party: 'Green Party', votes: noVoters.filter(d => d['Party'] === 'Green Party').length + noTellers.filter(d => d['Party'] === 'Green Party').length},
                {party: 'Independent', votes: noVoters.filter(d => d['Party'] === 'Independent').length + noTellers.filter(d => d['Party'] === 'Independent').length}
              ]
            }

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
