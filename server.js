var connect = require('connect'),
    app = connect(),
    http = require('http'),
    server = http.createServer(app),
    urlrouter = require('urlrouter'),
    io = require('socket.io').listen(server),
    fs = require('fs'),
    sys = require('sys'),
    util = require('util'),
    ent = require('ent'),
    port = 8866;

app.use(urlrouter(function(app) {
    app.get('/', function(req, res, next) {
        req.url = '/index.html';
        connect.utils.parseUrl(req);
        next();
    });
}));

app.use(connect.static(__dirname + '/www'));

server.listen(port);

io.set('log level', 2);

//Variable qui enregistre les noms des joueurs
var usernames = {};
//Variable qui stocke le lobby et le salon de jeu
var rooms = ['Lobby','Salon de jeu'];
//Variable qui stocke une partie
var games = {};


io.sockets.on('connection', function(socket) {

    //Permet d'afficher le nombre de personnes connectées sur la page d'accueil à l'utilisateur qui se connecte
    socket.emit('updatePlayersCount', Object.keys(usernames).length);

    //Gère un nouveau joueur qui se connecte
    socket.on('newUser', function(newname) {
        

        newusername = ent.encode(newname);
        testusername = ent.encode(newname.toLowerCase())

        if (usernames.hasOwnProperty(testusername)) { //On vérifie que le pseudo est disponible
            socket.emit('usernametaken');
            return;
        }

        socket.username = newusername;
        usernames[testusername] = testusername;

        socket.emit('welcomevisibility');
        socket.emit('roomvisibility');

        default_room = 'Lobby';
        socket.join(default_room);
        socket.room = default_room;
        
        socket.emit('updatechat', '', '<span style="color:black;">Vous êtes sur le <span style="color:blue;">' + default_room + '</span> !</span>');
        socket.broadcast.to(default_room).emit('updatechat', '', '<span style="color:black;">' + newusername + ' s\'est connecté au Lobby !</span>');

        //Nombres de joueurs dans le salon de jeu
        var nbusers = [];

        for (var i in rooms) {
            nbusers.push(checknumberofplayers(rooms[i]));
        }

        //Mise à jour de l'affichage des salons de jeu avec les nombres de joueurs et de spectateurs
        io.sockets.in('Lobby').emit('updateroom', rooms, 'Lobby', nbusers);

        socket.emit('updateroom', rooms, socket.room, nbusers);

        //Quand une personne se connecte, toutes les personnes sur la page d'accueil voient le nombre de personne connecté se mettre à jour (tout le monde reçoit mais ne sert qu'à ceux sur la page d'accueil)
        io.sockets.emit('updatePlayersCount', Object.keys(usernames).length);


    });

    //Calcule le nombre de joueurs
    var checknumberofplayers = function(room) {
        var nbusers = Object.keys(io.sockets.clients(room)).length;
        return nbusers;
    };
    
    socket.on('checknumberofplayers', function(room) {
        var nbusers = checknumberofplayers(room);
        socket.emit('updatePlayersCount', nbusers);
    });



    socket.on('sendchat', function(data) {

        if (!socket.username) {
            socket.emit('notconnected');
        } else {
            io.sockets.in(socket.room).emit('updatechat', socket.username + ' :', ent.encode(data)); //ent permet d'escaper les entités html pour éviter le code malicieux
        }
    });






// Quand un client dans le Lobby clique sur un salon
    socket.on('selectRoom', function(newroom) {

        
        
            // On fait quitter au joueur son salon
            socket.leave(socket.room);
            //On émet dans le salon qu'il vient de quitter une notif
            socket.broadcast.to(socket.room).emit('updatechat', '', '<span style="color:black;">' + socket.username + ' a quitté ce salon</span>');
        


        
        socket.join(newroom);
        socket.emit('updatechat', '', '<span style="color:black;">Vous êtes connecté au <span style="color:blue;">' + newroom + '</span><span>');



        socket.room = newroom;
        socket.broadcast.to(newroom).emit('updatechat', '', '<span style="color:black;">' + socket.username + ' a rejoins ce salon</span>');

        nbusers = [];

        for (var i in rooms) {
            nbusers.push(checknumberofplayers(rooms[i]));
        }


        io.sockets.in('Lobby').emit('updateroom', rooms, 'Lobby', nbusers); //Mise à jour des valeurs des joueurs dans les salons
        socket.emit('updateroom', rooms, newroom, nbusers); 


        socket.emit('roomvisibility'); 
        socket.emit('gamevisibility');


        if (socket.room in games) { //Si il y a un jeu lié au salon

            if (typeof games[socket.room].player2 != "undefined") { //On vérifie si un deuxième joueur avait été enregistré
                //Si oui le joueur devient spectateur
                games[socket.room].spectators.push(socket);
                socket.emit('spectating', games[socket.room].player1.username, games[socket.room].player2.username);

                if (games[socket.room].player1.ready == 1 && games[socket.room].player2.ready == 1) {
                    socket.emit('updateboard', games[socket.room].turn.username, games[socket.room].turn.id, games[socket.room].board, games[socket.room].player1.score, games[socket.room].player2.score, games[socket.room].player1.username, games[socket.room].player2.username);
                    socket.emit('boardvisibility');
                }
                return;
            }


            //Sinon il devient le joueur 2
            games[socket.room].player2 = socket;
            games[socket.room].player1.emit('newgame', games[socket.room].player2.username);
            games[socket.room].player2.emit('newgame', games[socket.room].player1.username);
            

        } else {
            games[socket.room] = {
                player1: socket, //Le client devient joueur 1
                board: [ 
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ],
                spectators: [],
                turn: null,
            };
            for(i=0; i<4; i++){ //On rajoute dans le plateau vide les numéros initiaux
                newpiece()
            }
            games[socket.room].player1.emit('waiting');
           
        }
    });


//Gère le retour dans le lobby
    socket.on('backToLobby', function() {

        socket.emit('gamevisibility');
        socket.emit('hideboardvisibility');
        socket.emit('roomvisibility');

        //On fait différents tests pour ne pas faire crasher le serveur
        if (games[socket.room]) {
            if (games[socket.room].player1 && games[socket.room].player2) {
                if (games[socket.room].player1.id == socket.id || games[socket.room].player2.id == socket.id) {
                    if (games[socket.room].player1.ready == 1 && games[socket.room].player2.ready == 1) {
                        socket.broadcast.to(socket.room).emit('gameended', games[socket.room].board,  games[socket.room].player1.username + ' VS ' + games[socket.room].player2.username, 'Déconnexion de ' + socket.username);
                    }
                }
            }
        }


        socket.broadcast.to(socket.room).emit('updatechat', '', '<span style="color:black;">' + socket.username + ' a quitté ce salon</span>');

        roomchangestate(socket);

        socket.leave(socket.room);
        socket.ready = 0;
        socket.score = 0;
        newroom = 'Lobby';
        socket.join(newroom);
        socket.room = newroom;

        var nbusers = [];

        for (var i in rooms) {
            nbusers.push(checknumberofplayers(rooms[i]));
        }

        //On met tous les affichages du nombre de joueurs dans les salons à jour
        io.sockets.in('Lobby').emit('updateroom', rooms, newroom, nbusers);
        socket.emit('updateroom', rooms, newroom, nbusers);
        socket.emit('updatechat', '', '<span style="color:black;">Vous êtes revenu sur le <span style="color:blue;">' + newroom + '</span> !</span>');
    });


    //appelé si retour au lobby ou déconnexion
    var roomchangestate = function(socket) {

        //permet de faire des action différentes en fonction du nombre de joueur restant le salon quand on enlève la personne qui part

        if (socket.room && games[socket.room]) {
            var nbplayers = checknumberofplayers(socket.room) - 1; //-1 car on a pas encore fait le socket.leave(socket.room); quand cette fonction est appelée


            if (nbplayers == 0) {
                delete games[socket.room]; //pas de joueur restant : on supprime le salon Permettrait d'éviter si on laissait la possibiltié aux joueurs de créer leur salon d'avoir 3000 salons car ils ne sont pas supprimés (à la création du salon, le joueur serait dedans, donc tant qu'il y a un joueur dans le salon le salon pourrait exister)
                var bool = true;
            } else if (nbplayers == 1) {

                //On supprime les références au joueur qui vient de se déconnecter (2 personnes dans le salon donc les deux sont joueurs)
                var bool = true;
                if (games[socket.room].player1.id == socket.id) {
                    
                    games[socket.room].player1.ready = 0;
                    games[socket.room].player1.score = 0;
                    games[socket.room].player1 = games[socket.room].player2;

                    delete games[socket.room].player2;
                    games[socket.room].player1.ready = 0;
                    games[socket.room].player1.score = 0;

                } else {
                    games[socket.room].player2.ready = 0;
                    games[socket.room].player2.score = 0;

                    delete games[socket.room].player2;
                    games[socket.room].player1.ready = 0;
                    games[socket.room].player1.score = 0;

                }


            } else if (nbplayers >= 2) {

                //Si au moins un spectateur, si c'est un spectateur qui quitte, on met à jour le vecteur de spectateur. Si c'est un joueur, le premier spectateur arrivé devient joueur
                if (games[socket.room].player1.id == socket.id) {
                    games[socket.room].player1 = games[socket.room].spectators[0];
                    games[socket.room].spectators.splice(0, 1);
                    games[socket.room].player1.ready = 0;
                    games[socket.room].player1.score = 0;
                    games[socket.room].player2.ready = 0;
                    games[socket.room].player2.score = 0;

                    var bool = true;
                } else if (games[socket.room].player2.id == socket.id) {
                    games[socket.room].player2 = games[socket.room].spectators[0];
                    games[socket.room].spectators.splice(0, 1);
                    games[socket.room].player1.ready = 0;
                    games[socket.room].player1.score = 0;
                    games[socket.room].player2.ready = 0;
                    games[socket.room].player2.score = 0;
                    var bool = true;
                } else {
                    var index = games[socket.room].spectators.indexOf(socket);
                    var bool = false;

                    if (index > -1) {
                        games[socket.room].spectators.splice(index, 1);
                    }
                }



            }

            resetroomafterdisconnect(socket.room, nbplayers, bool); //On reset la room pour permettre un nouveau match
        }
    }


    //Lorsque un joueur clique sur "commencer la partie"
    socket.on('gamerequested', function() {

        if (socket.id == games[socket.room].player1.id) {
            games[socket.room].player1.ready = 1;
            games[socket.room].player1.score = 0;
        }
        if (socket.id == games[socket.room].player2.id) {
            games[socket.room].player2.ready = 1;
            games[socket.room].player2.score = 0;
        }

        //Lorsque les deux joeuurs sont prêt on commence le jeu
        if (games[socket.room].player2.ready == 1 && games[socket.room].player1.ready == 1) {
            io.sockets.in(socket.room).emit('boardvisibility');
            games[socket.room].turn = games[socket.room].player1;
            io.sockets.in(socket.room).emit('updateboard', games[socket.room].turn.username, games[socket.room].turn.id, games[socket.room].board, games[socket.room].player1.score, games[socket.room].player2.score, games[socket.room].player1.username, games[socket.room].player2.username);
            io.sockets.in(socket.room).emit('updatechat', '', '<span style="color:#48ba69;">Début du match !</span>');
        }

    });

    // Gère la déconnection d'un joueur
    socket.on('disconnect', function() {
    
        //on reteste en cascade (toujours pour éviter le crash du serveur si certaines valeurs ne sont pas définies) si le joueur était dans un jeu et on arrête le jeu en conséquence
        if (games[socket.room]) {
            if (games[socket.room].player1 && games[socket.room].player2) {
                if (games[socket.room].player1.id == socket.id || games[socket.room].player2.id == socket.id) {
                socket.broadcast.to(socket.room).emit('gameended', games[socket.room].board, games[socket.room].player1.username + ' VS ' + games[socket.room].player2.username, 'Déconnexion de ' + socket.username + ' :(');
                if (games[socket.room].player1.ready == 1 && games[socket.room].player2.ready == 1) {
                    socket.broadcast.to(socket.room).emit('boardvisibility');
                }
            }
            }
        }

        roomchangestate(socket);

        //On oublie pas de supprimer l'utilisateur de la liste
        delete usernames[socket.username];
        // on évite d'envoyer les messages à la room null lorsque la personne n'est pas connectée
        for (var i in rooms) {
            socket.broadcast.to(rooms[i]).emit('updatechat', '', '<span style="color:black;">' + socket.username + ' s\'est déconnecté</span>');
        }
        
        socket.leave(socket.room);
        io.sockets.emit('updatePlayersCount', Object.keys(usernames).length);

    });










    var resetroomaftermatch = function(room, nbplayers) {


        if (games[room]) {

            //On reset la board
            games[room].board = [
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0]
            ];
            for(i=0; i<4; i++){
                newpiece()
            }
            if (nbplayers == 1) {
                //si il ne reste qu'un joueur on met à jour l'affichage en conséquences
                games[room].player1.ready = 0;
                games[room].player1.score = 0;
                io.sockets.in(socket.room).emit('hideboardvisibility');
                io.sockets.in(socket.room).emit('updateboard', "", games[socket.room].board, games[socket.room].player1.score, '', games[socket.room].player1.username, '');
                games[socket.room].player1.emit('waiting');
            }

            if (nbplayers >= 2) {

                //on change le joueur qui commence en premier
                var temp;
                temp=games[room].player1;
                games[room].player1=games[room].player2;
                games[room].player2=temp;

                //on met à jour leur ready
                games[room].player1.ready = 0;
                games[room].player1.score = 0;
                games[room].player2.ready = 0;
                games[room].player2.score = 0;

                for (var i in games[socket.room].spectators) {
                    games[socket.room].spectators[i].emit('spectating', games[socket.room].player1.username, games[socket.room].player2.username);
                }

                io.sockets.in(socket.room).emit('hideboardvisibility');

                //on fait apparaitre le bouton commencer partie pour les deux joueurs
                games[room].player1.emit('newgame', games[room].player2.username);
                games[room].player2.emit('newgame', games[room].player1.username);
            }
        }
    }



    //On reset la room après une déconnexion
    var resetroomafterdisconnect = function(room, nbplayers, bool) {


        if (games[room]) {




            if (nbplayers == 1) {
                games[room].board = [
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ];
                for(i=0; i<4; i++){ //On rajoute dans le plateau vide les numéros initiaux
                    newpiece()
                }
                games[room].player1.ready = 0;
                games[room].player1.score = 0;
                io.sockets.in(socket.room).emit('hideboardvisibility');
                io.sockets.in(socket.room).emit('updateboard', "", games[socket.room].board, games[socket.room].player1.score, '', games[socket.room].player1.username, '');
                games[socket.room].player1.emit('waiting');
            }

            if (nbplayers >= 2) {

                if (bool) {
                    games[room].board = [
                        [0, 0, 0, 0],
                        [0, 0, 0, 0],
                        [0, 0, 0, 0],
                        [0, 0, 0, 0]
                    ];
                    for(i=0; i<4; i++){ //On rajoute dans le plateau vide les numéros initiaux
                        newpiece()
                    }

                    for (var i in games[socket.room].spectators) {
                        games[socket.room].spectators[i].emit('spectating', games[socket.room].player1.username, games[socket.room].player2.username);
                    }
                    io.sockets.in(socket.room).emit('updateboard', "", games[socket.room].board, games[socket.room].player1.score, games[socket.room].player2.score, games[socket.room].player1.username, games[socket.room].player2.username);
                    io.sockets.in(socket.room).emit('hideboardvisibility');
                    games[room].player1.emit('newgame', games[room].player2.username);
                    games[room].player2.emit('newgame', games[room].player1.username);
                } else {

                }
            }
        }
    };


    socket.on('processgame', function(move) {
        var Score = 0
        if (move == 'up'){
            var plateauchange = false
            //parcours du haut vers le bas sans prendre la première ligne
            for(i=3; i>0; i--){
                for(j=0; j<4; j++){
                    //Cas 1 : case vide au dessus
                    if (games[socket.room].board[i-1][j] == 0 && games[socket.room].board[i][j] != 0){
                        games[socket.room].board[i-1][j] = games[socket.room].board[i][j]
                        games[socket.room].board[i][j] = 0
                        plateauchange = true

                        //décalage des tuiles en dessous
                        if(i==3){
                            games[socket.room].board[i][j] = 0
                        }
                        else{
                            for(d=i; d<3;d++){
                                games[socket.room].board[d][j] = games[socket.room].board[d+1][j];
                             }
                             games[socket.room].board[3][j] = 0;
                         }
                    }

                    //Cas 2 : case de même valeur au-dessus
                    if(games[socket.room].board[i-1][j] == games[socket.room].board[i][j] && games[socket.room].board[i][j] != 0){
                        games[socket.room].board[i-1][j] = 2*games[socket.room].board[i][j];
                        Score += games[socket.room].board[i-1][j];
                        plateauchange = true
        
                        // Décalage des tuiles en-dessous
                        if(i==3){
                            games[socket.room].board[i][j] = 0;
                        }
                        else{
                            for(d=i; d<3;d++){
                                games[socket.room].board[d][j] = games[socket.room].board[d+1][j];
                            }
                            games[socket.room].board[3][j] = 0;
                        }
                    }
                }
            }
        }
        else if (move == 'down'){
            var plateauchange = false
            //parcours du bas vers le haut sans prendre la dernière ligne
            for(i=0; i<3; i++){
                for(j=0; j<4; j++){
                    //Cas 1 : case vide au dessus
                    if (games[socket.room].board[i+1][j] == 0 && games[socket.room].board[i][j] != 0){
                        games[socket.room].board[i+1][j] = games[socket.room].board[i][j]
                        games[socket.room].board[i][j] = 0
                        plateauchange = true

                        //décalage des tuiles en dessous
                        if(i==0){
                            games[socket.room].board[i][j] = 0
                        }
                        else{
                            for(d=i; d>0;d--){
                                games[socket.room].board[d][j] = games[socket.room].board[d-1][j];
                             }
                             games[socket.room].board[0][j] = 0;
                         }
                    }

                    //Cas 2 : casede même valeur au-dessus
                    if(games[socket.room].board[i+1][j] == games[socket.room].board[i][j] && games[socket.room].board[i][j] != 0){
                        games[socket.room].board[i+1][j] = 2*games[socket.room].board[i][j];
                        Score += games[socket.room].board[i+1][j];
                        plateauchange = true
        
                        // Décalage des tuiles en-dessous
                        if(i==0){
                            games[socket.room].board[i][j] = 0;
                        }
                        else{
                            for(d=i; d>0;d--){
                                games[socket.room].board[d][j] = games[socket.room].board[d-1][j];
                            }
                            games[socket.room].board[0][j] = 0;
                            
                        }
                    }
                }
            }
        }
        else if (move == 'left'){
            var plateauchange = false
            //parcours de la gauche vers la droite sans prendre la première colonne
            for(j=3; j>0; j--){
                for(i=0; i<4; i++){
                    //Cas 1 : case vide au dessus
                    if (games[socket.room].board[i][j-1] == 0 && games[socket.room].board[i][j] != 0){
                        games[socket.room].board[i][j-1] = games[socket.room].board[i][j]
                        games[socket.room].board[i][j] = 0
                        plateauchange = true

                        //décalage des tuiles à droite
                        if(j==3){
                            games[socket.room].board[i][j] = 0
                        }
                        else{
                            for(d=j; d<3;d++){
                                games[socket.room].board[i][d] = games[socket.room].board[i][d+1];
                             }
                             games[socket.room].board[i][3] = 0;
                         }
                    }

                    //Cas 2 : casede même valeur au-dessus
                    if(games[socket.room].board[i][j-1] == games[socket.room].board[i][j] && games[socket.room].board[i][j] != 0){
                        games[socket.room].board[i][j-1] = 2*games[socket.room].board[i][j];
                        Score += games[socket.room].board[i][j-1];
                        plateauchange = true
        
                        // Décalage des tuiles en-dessous
                        if(j==3){
                            games[socket.room].board[i][j] = 0;
                        }
                        else{
                            for(d=j; d<3;d++){
                                games[socket.room].board[i][d] = games[socket.room].board[i][d+1];
                            }
                            games[socket.room].board[i][3] = 0;
                        }
                    }
                }
            }
        }
        else if (move == 'right'){
            var plateauchange = false
            //parcours de la droite vers la gauche sans prendre la dernière colonne
            for(j=0; j<3; j++){
                for(i=0; i<4; i++){
                    //Cas 1 : case vide à droite
                    if (games[socket.room].board[i][j+1] == 0 && games[socket.room].board[i][j] != 0){
                        games[socket.room].board[i][j+1] = games[socket.room].board[i][j]
                        games[socket.room].board[i][j] = 0
                        plateauchange = true

                        //décalage des tuiles à gauche
                        if(j==0){
                            games[socket.room].board[i][j] = 0
                        }
                        else{
                            for(d=j; d>0;d--){
                                games[socket.room].board[i][d] = games[socket.room].board[i][d-1];
                             }
                             games[socket.room].board[i][0] = 0;
                         }
                    }

                    //Cas 2 : casede même valeur à droite
                    if(games[socket.room].board[i][j+1] == games[socket.room].board[i][j] && games[socket.room].board[i][j] != 0){
                        games[socket.room].board[i][j+1] = 2*games[socket.room].board[i][j];
                        Score += games[socket.room].board[i][j+1];
                        plateauchange = true
        
                        // Décalage des tuiles à gauche
                        if(j==0){
                            games[socket.room].board[i][j] = 0;
                        }
                        else{
                            for(d=j; d>0; d--){
                                games[socket.room].board[i][d] = games[socket.room].board[i][d-1];
                            }
                            games[socket.room].board[i][0] = 0;
                        }
                    }
                }
            }
        }

        if (plateauchange){
            newpiece()
            //On regarde c'était le tour de quel joueur
            if (socket.id == games[socket.room].player1.id) {
                games[socket.room].player1.score += Score
                
                games[socket.room].turn = games[socket.room].player2; //On change de joueur qui peut jouer

            } else {
                games[socket.room].player2.score += Score

                games[socket.room].turn = games[socket.room].player1; //On change de joueur qui peut jouer

            }
        }

        


        //on vérifie si il y a fin de partie
        if (checkiffin(socket.room)) {

            io.sockets.in(socket.room).emit('updateboard', '', '', games[socket.room].board, games[socket.room].player1.score, games[socket.room].player2.score, games[socket.room].player1.username, games[socket.room].player2.username);              

            //On met une jolie notif de fin
            if (games[socket.room].player1.score < games[socket.room].player2.score) {
                io.sockets.in(socket.room).emit('gameended', games[socket.room].board, games[socket.room].player1.username + ' VS ' + games[socket.room].player2.username , 'Victoire de ' + games[socket.room].player2.username + ' !');
            } else if (games[socket.room].player1.score > games[socket.room].player2.score) {
                io.sockets.in(socket.room).emit('gameended', games[socket.room].board, games[socket.room].player1.username + ' VS ' + games[socket.room].player2.username , 'Victoire de ' + games[socket.room].player1.username + ' !');
            } else {
                io.sockets.in(socket.room).emit('gameended', games[socket.room].board, games[socket.room].player1.username + ' VS ' + games[socket.room].player2.username , 'Match nul !');
            }
                
            var nbplayers = checknumberofplayers(socket.room);
            resetroomaftermatch(socket.room, nbplayers); //On reset le jeu

            io.sockets.in(socket.room).emit('updatechat', '', '<span style="color:#48ba69;">Victoire de ' + socket.username + ' !</span>');

            return;
        }


        //Si pas de fin, on continue le jeu avec la mise à jour du board
        io.sockets.in(socket.room).emit('updateboard', games[socket.room].turn.username, games[socket.room].turn.id, games[socket.room].board, games[socket.room].player1.score, games[socket.room].player2.score, games[socket.room].player1.username, games[socket.room].player2.username);

        

        

    });


    var newpiece = function(){
        testeur = false
        while(!testeur){
            var indice = Math.floor(Math.random()*16)
            if(games[socket.room].board[Math.floor(indice/4)][indice%4] == 0){
                pourcentage = Math.floor(Math.random()*100)
                if(pourcentage<94){
                    games[socket.room].board[Math.floor(indice/4)][indice%4] = 2
                }
                else{
                    games[socket.room].board[Math.floor(indice/4)][indice%4] = 4
                }
                testeur = true
            }
        }
    }

    //On checke si fin
    var checkiffin = function(room) {
        var board = games[room].board;
        var bool = true;

        for (i=0; i<4; i++){
            for (j=0; j<4; j++){
                if (board[i][j]==0){
                    bool = false;
                }
                else if (i==0){
                    if (j==0){
                        if (board[i+1][j]==board[i][j] || board[i][j+1]==board[i][j]){
                            bool = false;
                        }
                    }
                    else if (j==3){
                        if (board[i+1][j]==board[i][j] || board[i][j-1]==board[i][j]){
                            bool = false;
                        }
                    }
                    else{
                        if (board[i+1][j]==board[i][j] || board[i][j-1]==board[i][j] || board[i][j+1]==board[i][j]){
                            bool = false;
                        }
                    }
                }
                else if (i==3){
                    if (j==0){
                        if (board[i-1][j]==board[i][j] || board[i][j+1]==board[i][j]){
                            bool = false;
                        }
                    }
                    else if (j==3){
                        if (board[i-1][j]==board[i][j] || board[i][j-1]==board[i][j]){
                            bool = false;
                        }
                    }
                    else{
                        if (board[i-1][j]==board[i][j] || board[i][j-1]==board[i][j] || board[i][j+1]==board[i][j]){
                            bool = false;
                        }
                    }
                }
                else{
                    if (j==0){
                        if (board[i+1][j]==board[i][j] || board[i][j+1]==board[i][j] || board[i-1][j]==board[i][j]){
                            bool = false;
                        }
                    }
                    else if (j==3){
                        if (board[i+1][j]==board[i][j] || board[i][j-1]==board[i][j] || board[i-1][j]==board[i][j]){
                            bool = false;
                        }
                    }
                    else{
                        if (board[i+1][j]==board[i][j] || board[i][j-1]==board[i][j] || board[i][j+1]==board[i][j] || board[i-1][j]==board[i][j]){
                            bool = false;
                        }
                    }
                }
            }
        }
        return bool;
    }
    





















});



