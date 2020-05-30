# screeps-benchmark

## purpose and target audience
the target audience for this tool are strictly users with full auto bots that can make use of the "auto" spawn system.
it is meant for people who want to check whether they are ready to compete in challenges like botarena.

as the name suggests this is a tool that helps you benchmark your bot.
for now the focus is on the performance within the first safe mode. the tool will set up the server for a speedy test
(as much as the screeps server and your hardware allows), spawn your bot in a couple rooms and check for defined milestones
(structures built, RCL upgrades). this should then give you some info that allows you to compare your bots performance
to other bots. this way you have a chance to see whether you can get out of the first safe mode with a competitive room/eco.

## requirements
- node >= 10.x.x
- npm >= 6.x.x
- windows os (for now, sorry *nix users :| )

## how to
1. `npm i`
2. `npm run exec`
3. first run should error out checking for a steam key in your config.yml and instruct you on how to set that up
4. `npm run exec`
5. follow the instructions and you should be good to go!
