# Jelly Tetris
A physics based version of Tetris. The pieces are made of particles connected together, and are flexible, so pieces can wobble and bend.


## How to play
- Left/right arrow: Move the active piece
- Up arrow: Rotate the active piece
- Down arrow: Drop the piece
As more horizontal pieces are cleared, each time it adds 100 points.

## The physics stuff
The pieces are simulated as soft bodies with the particles and sticks connecting them.
Collision handling pretty much just nudges the overlapping particles away
