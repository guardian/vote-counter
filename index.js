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

    const urls = divisions.map(division => `http://lda.data.parliament.uk/commonsdivisions/id/${division}.json?_properties=teller.memberPrinted`)
    // get all members info
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
            const primaryTopic = res.result.primaryTopic;
            const voters = primaryTopic.vote;
            const tellers = primaryTopic.teller;
            const voteTitle = primaryTopic.title;
            const divisionNumber = primaryTopic.divisionNumber;
            const divisionRecap = {
              title: voteTitle,
              uin: primaryTopic.uin,
              number: divisionNumber,
              date: primaryTopic.date['_value'],
              ayesCount: primaryTopic['AyesCount'][0]['_value'],
              noesCount: primaryTopic['Noesvotecount'][0]['_value'],
              abstainCount: primaryTopic['AbstainCount'][0]['_value'],
              didNotVoteCount: primaryTopic['Didnotvotecount'][0]['_value'],
              errorCount: primaryTopic['Errorvotecount'][0]['_value'],
              nonEligibleCount: primaryTopic['Noneligiblecount'][0]['_value'],
              suspendedOrExpelledCount: primaryTopic['Suspendedorexpelledvotescount'][0]['_value'],
              margin: primaryTopic['Margin'][0]['_value']
            }

            let vote;

            final.divisionsInfo.push(divisionRecap);

            allMembers.map(member => {
              const memberExists = voters.find(voter =>
                member.id === voter.member[0]['_about'].substring(voter.member[0]['_about'].lastIndexOf('/') + 1)
              );

              const memberIsTeller = tellers.find(teller =>
                member.name === teller.memberPrinted['_value']
              )

              if (memberExists) {
                vote = memberExists.type.substring(memberExists.type.lastIndexOf('#') + 1);
              } else if (memberIsTeller) {
                const splitStr = memberIsTeller['_about'].split('/');

                vote = splitStr[splitStr.length - 2] === 'AyeTellers' ? 'AyeVote' : 'NoVote';
              }

              member.votes.push({
                voteTitle,
                divisionNumber,
                vote,
                teller: memberIsTeller ? true : false
              })
            })
          })

          final.membersInfo = allMembers;

          return final;

        }).then(final => {
          fs.writeFileSync(`./votes.json`, JSON.stringify(final));
          }).catch(e => console.log('Something went wrong fetching the data. Make sure you have entered valid divisions ids.'))
      })

    rl.close();
  }
});
