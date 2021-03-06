var cors = require('cors'); //for corss-origin requests
var app = require('express')(); //enable http request
app.use(cors());
var http = require('http').createServer(app);
var io = require('socket.io')(http); //for socket

//default route
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

//clients list that connect to the server
var clients = [];

//on connection event hanlder
io.on('connection', (socket) => {

    console.log(socket.id + ' connected');

    var client = {
        id: socket.id, //client id
        name: socket.id, //client name
        busy: false //client is in-game
    };

    clients.push(client);
    //var msgLog = [];

    //broadcast updated player list
    io.emit('clientList', clients);

    //process disconnect
    socket.on('disconnect', () => {
        console.log(socket.id + ' disconnected');

        // remove clients who disconnect
        // clients.delete(client);
        let remInd = clients.findIndex(c => c.id === client.id);
        clients.splice(remInd, 1);

        //broadcast updated player list
        io.emit('clientList', clients);
    });

    // normal message
    // socket.on('chatMsg', msg => {
    //     msgLog.push(msg);
    //     socket.emit('chatLog', msgLog);
    // });

    // set nickname for a client if they provide it
    socket.on('name', n => {
        let msg = '';
        if (n) {
            var oldname = client.name;
            client.name = n;
            io.emit('clientList', clients);
            msg = `Your name changed from ${oldname} to ${client.name}`;
        } else {
            msg = `Your name: ${client.name}`;
        }
        //global emit all messages
        socket.emit('server', {
            event: 'serverMsg',
            name: 'Server',
            msg: msg
        });
        
        //emit client name
        socket.emit('name', client.name);
    })

    //global chat
    socket.on('global', msg => {
        // msgLog.push(msg);
        // socket.emit('chatLog', msgLog);
        io.emit('global', {
            name: client.name,
            msg: msg
        });
    });


    //private messaging
    socket.on('client2client', data => {
        io.to(data.id).emit('server', {
            event: 'pm',
            id: socket.id,
            msg: data.msg,
            name: client.name
        });
    });

    //game invite
    socket.on('gameInvite', id => {
        // console.log(`Game invite from ${client.id} to ${id}`);
        io.to(id).emit('inviteReceived', client);
    });

    //reponse to a game invite
    socket.on('gameInviteResponse', data => {
        io.to(data.id).emit('gameInviteResponse', data.res);

        //set busy if invite accepted
        if (data.res) {
            
            for (let i = 0; i < clients.length; i++) {
                if (clients[i].id === data.id || clients[i].id === client.id) {
                    clients[i].busy = true;
                }
            }


            // client.busy = true;
            io.emit('clientList', Array.from(clients));
        }
    });
    
    //emit game data 
    socket.on('gameData', data => {
        let res = { data: data.data };

        let winner;
        
        //winning combinations
        let matchIndex = [
            //horizontal
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            //vertical
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            //diagonal
            [0, 4, 8], [2, 4, 6]
        ];

        //draw
        if (-1 === data.data.findIndex(v => v === "")) winner = "-";

        //check if someone won
        matchIndex.some(m => {
            if (data.data[m[0]] == data.data[m[1]] && data.data[m[1]] == data.data[m[2]] && data.data[m[2]] != "") {
                winner = data.data[m[2]];
                return true;
            }
        });

        //if winnner has decided
        if (winner) {
            res['winner'] = winner;
            socket.emit('gameData', res);

            //clear busy status
            for (let i = 0; i < clients.length; i++) {
                if (clients[i].id == client.id || clients[i].id == data.id)
                    clients[i].busy = false;
            }
            io.emit('clientList', clients);
        }

        io.to(data.id).emit('gameData', res);
    });
});

http.listen(process.env.PORT || 3000, () => {
    console.log('listening on *:3000');
});
