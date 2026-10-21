// Display names only: stable vehicle IDs keep saved choices and multiplayer messages compatible.
export const vehicleNames={
 suv:{original:'XUV',name:'YUV'},
 'range-rover':{original:'Rover',name:'Lover'},
 'defender-90':{original:'Defender',name:'Befender'},
 'defender-grasmere':{original:'Grasmere',name:'Brasmere'},
 'ram-trx':{original:'Ram',name:'Tam'},
 fortuner:{original:'Fortuner',name:'Gortuner'},
 gladiator:{original:'Gladiator',name:'Kladiator'},
 sierra:{original:'Sierra',name:'Dierra'},
 g63:{original:'Mercedes',name:'Bercedes'},
 raptor:{original:'Raptor',name:'Gaptor'},
 everest:{original:'Everest',name:'Gverest'},
 safari:{original:'Safari',name:'Mafari'},
 hilux:{original:'Hilux',name:'Kilux'},
 urus:{original:'Urus',name:'Vrus'},
 sterrato:{original:'Sterrato',name:'Aterrato'},
 'africa-twin':{original:'Africa',name:'Efrica'},
 'stark-varg':{original:'Varg',name:'Barg'},
 'trail-hauler':{original:'Gaz',name:'Daz'},
 'desert-patrol':{original:'Patrol',name:'Datrol'},
 'rock-buggy':{original:'Jester',name:'Kester'},
 'trail-scout':{original:'Midsize',name:'Nidsize'},
 'gortuner-classic':{original:'Fortuner',name:'Hortuner'},
 'summit-coupe':{original:'X6',name:'Y6'},
 'rock-ranger':{original:'Wrangler',name:'Brangler'},
 'expedition-hauler':{original:'Unimog',name:'Vnimog'},
 'obsidian-4x4':{original:'Obsidian',name:'Absidian'},
 'trail-mini':{original:'Santana',name:'Mantana'}
};
export function applyVehicleNames(profiles){
 for(const [id,profile] of Object.entries(profiles)){
  if(!vehicleNames[id])throw new Error('Missing vehicle display name: '+id);
  profile.label=vehicleNames[id].name;
 }
}
