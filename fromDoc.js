const fs = require('fs');
const fetch = require('node-fetch');
const _ = require('lodash');

async function fetchAll() {
  const glossesUrl = "https://interactive.guim.co.uk/docsdata-test/1TvMfmTvlemRxZ-OST9e7CyeSIul7ATmAew9FTVwYczU.json"
  const membersUrl = "http://data.parliament.uk/membersdataplatform/services/mnis/members/query/House=Commons%7CIsEligible=true/"
  
  const glosRes = await fetch(glossesUrl)
  const glossesJson = await glosRes.json()
  const glosses = glossesJson['sheets']['Sheet1']
  const membersRes = await fetch(membersUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' }}) 
  const membersText = await membersRes.text()
  const members = await JSON.parse(membersText.trim())
  const divisionIds = glosses.map(d => Number(d.divisionId))

  console.log("our ids", divisionIds)
  
  const allMembers = members['Members']['Member'].map(member => {
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
  
  const divisionUrls = divisionIds.map(id => `https://commonsvotes-services.digiminster.com/data/division/${id}.json`) //new api
  const allDivisions = await Promise.all(divisionUrls.map(url => fetch(url, { timeout: 0 }).then(res => res.json())))

  //console.log(allDivisions)

  const divisionsInfo = glosses.map(d => {

    console.log("gloss id", d.divisionId)
    console.log(allDivisions.filter(d => d).map(j => j.DivisionId))


    const glossText = d.amendmentGloss;
    const glossTitle = d.amendmentTitle;
    const isMainVote = d.isFinalVote == 1 ? true : false;
    const ayeWithGvt = d.ayeWithGvt === 1 ? true : false;

    
    const matchingDivision = allDivisions.find(div => Number(div['DivisionId']) === Number(d.divisionId))
    

    if (!matchingDivision) {
      console.log('nomatch')
      return ({
        glossText,
        glossTitle,
        isMainVote,
        ayeWithGvt,
        hasData: false
      })
    } else {
      const ayeVoters = matchingDivision['Ayes'];
      const noVoters = matchingDivision['Noes'];
      const ayeTellers = matchingDivision['AyeTellers'];
      const noTellers = matchingDivision['NoTellers'];
      const voteTitle = matchingDivision['Title'];
      const divisionNumber = matchingDivision['Number'];
      const divisionId = matchingDivision['DivisionId'];

      return ({
        glossText,
        glossTitle,
        isMainVote,
        ayeWithGvt,
        hasData: true,
        title: voteTitle,
        number: divisionNumber,
        id: divisionId,
        date: matchingDivision['Date'],
        ayesCount: matchingDivision['AyeCount'] + ayeTellers.length,
        noesCount: matchingDivision['NoCount'] + noTellers.length,
        abstainCount: allMembers.length - ayeVoters.length - noVoters.length - ayeTellers.length - noTellers.length,
        ayesByParty: [
          { party: 'Labour', votes: ayeVoters.filter(d => d['Party'] === 'Labour' || d['Party'] === 'Labour (Co-op)').length + ayeTellers.filter(d => d['Party'] === 'Labour').length },
          { party: 'Conservative', votes: ayeVoters.filter(d => d['Party'] === 'Conservative').length + ayeTellers.filter(d => d['Party'] === 'Conservative').length },
          { party: 'Scottish National Party', votes: ayeVoters.filter(d => d['Party'] === 'Scottish National Party').length + ayeTellers.filter(d => d['Party'] === 'Scottish National Party').length },
          { party: 'Liberal Democrat', votes: ayeVoters.filter(d => d['Party'] === 'Liberal Democrat').length + ayeTellers.filter(d => d['Party'] === 'Liberal Democrat').length },
          { party: 'Sinn Féin', votes: ayeVoters.filter(d => d['Party'] === 'Sinn Féin').length + ayeTellers.filter(d => d['Party'] === 'Sinn Féin').length },
          { party: 'Plaid Cymru', votes: ayeVoters.filter(d => d['Party'] === 'Plaid Cymru').length + ayeTellers.filter(d => d['Party'] === 'Plaid Cymru').length },
          { party: 'Democratic Unionist Party', votes: ayeVoters.filter(d => d['Party'] === 'Democratic Unionist Party').length + ayeTellers.filter(d => d['Party'] === 'Democratic Unionist Party').length },
          { party: 'Green Party', votes: ayeVoters.filter(d => d['Party'] === 'Green Party').length + ayeTellers.filter(d => d['Party'] === 'Green Party').length },
          { party: 'Independent', votes: ayeVoters.filter(d => d['Party'] === 'Independent').length + ayeTellers.filter(d => d['Party'] === 'Independent').length }
        ].sort((a, b) => {
          if (a.votes !== b.votes) {
            return b.votes - a.votes
          } else {
            if (b.party > a.party) {
              return -1
            } else {
              return 1
            }
          }
        }),
        noesByParty: [
          { party: 'Labour', votes: noVoters.filter(d => d['Party'] === 'Labour' || d['Party'] === 'Labour (Co-op)').length + noTellers.filter(d => d['Party'] === 'Labour').length },
          { party: 'Conservative', votes: noVoters.filter(d => d['Party'] === 'Conservative').length + noTellers.filter(d => d['Party'] === 'Conservative').length },
          { party: 'Scottish National Party', votes: noVoters.filter(d => d['Party'] === 'Scottish National Party').length + noTellers.filter(d => d['Party'] === 'Scottish National Party').length },
          { party: 'Liberal Democrat', votes: noVoters.filter(d => d['Party'] === 'Liberal Democrat').length + noTellers.filter(d => d['Party'] === 'Liberal Democrat').length },
          { party: 'Sinn Féin', votes: noVoters.filter(d => d['Party'] === 'Sinn Féin').length + noTellers.filter(d => d['Party'] === 'Sinn Féin').length },
          { party: 'Plaid Cymru', votes: noVoters.filter(d => d['Party'] === 'Plaid Cymru').length + noTellers.filter(d => d['Party'] === 'Plaid Cymru').length },
          { party: 'Democratic Unionist Party', votes: noVoters.filter(d => d['Party'] === 'Democratic Unionist Party').length + noTellers.filter(d => d['Party'] === 'Democratic Unionist Party').length },
          { party: 'Green Party', votes: noVoters.filter(d => d['Party'] === 'Green Party').length + noTellers.filter(d => d['Party'] === 'Green Party').length },
          { party: 'Independent', votes: noVoters.filter(d => d['Party'] === 'Independent').length + noTellers.filter(d => d['Party'] === 'Independent').length }
        ].sort((a, b) => {
          if (a.votes !== b.votes) {
            return b.votes - a.votes
          } else {
            if (b.party > a.party) {
              return -1
            } else {
              return 1
            }
          }
        })
      })
    }
  })

  allDivisions.forEach(d => {
    const ayeVoters = d['Ayes'];
    const noVoters = d['Noes'];
    const ayeTellers = d['AyeTellers'];
    const noTellers = d['NoTellers'];
    const voteTitle = d['Title'];
    const divisionNumber = d['Number'];
    const divisionId = d['DivisionId'];

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
      
      const matchingGloss = glosses.find(g => Number(g.divisionId) === Number(divisionId));
      
      member.votes.push({
        voteTitle,
        divisionNumber,
        divisionId,
        vote,
        teller: isTeller,
        glossText: matchingGloss.amendmentGloss,
        glossTitle: matchingGloss.amendmentTitle,
        isMainVote: matchingGloss.isFinalVote == 1 ? true : false,
        ayeWithGvt: matchingGloss.ayeWithGvt === 1 ? true : false
      })
    })

    
  })

  const final = {
    divisionsInfo,
    membersInfo: allMembers
  }

  console.log('data for ' + divisionsInfo.filter(d => d.hasData === true).length + ' divisions added')
  console.log(allMembers.length, 'members fetched')

  fs.writeFileSync(`./votesNew.json`, JSON.stringify(final))

}

fetchAll()