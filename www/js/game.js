var socket = io.connect('http://localhost:8866');

//Gère le chargement de la page
$(function() {

    //Gère le choix du pseudo
    $('#join').bind('click', function() {
        $('#error').html('&nbsp;');
        if (!$('#nickname').val().length) {
            $('#error').html('Vous devez choisir un pseudo !');
            return;
        }
        socket.emit('newUser', $('#nickname').val());
    });

    //Gère le retour au lobby
    $('#exit').click(function() {
        socket.emit('backToLobby');
    });

    //Au lancement de la page on cache certains éléments
    $('#gameended').toggle();
    $('#rooms').toggle();
    $('#game').toggle();
    $('#gameboard').toggle();

    //Gère l'envoie d'un message dans le chat
    $('#data').keypress(function(e) {
        if (e.which == 13) {
            $(this).blur();
            $('#datasend').focus().click();
            $(this).focus().select();
        }
    });
    $('#datasend').click(function() {
        var message = $('#data').val();
        $('#data').val('');
        if (message) {
            socket.emit('sendchat', message);
        }
    });

});

//Update du chat
socket.on('updatechat', function(username, data) {
    $('#discution').append('<b>' + username + '</b> ' + data + '<br>');
});

//Affiche le nombre de joueurs
socket.on('updatePlayersCount', function(number) {
    if (!number) {
        numerb = "0";
    }
    $('#players').html(number);
});

//Empêche d'utiliser le chat sans avoir rentré un pseudo
socket.on('notconnected', function() {
    alert("Il faut se connecter pour utiliser le chat");
});

//Empêche de prendre un pseudo non disponible
socket.on('usernametaken', function() {
    $('#error').html('Pseudo non disponible');
});

//Fonctions qui affichent ou cachent différents éléments
socket.on('welcomevisibility', function() {
    $('#welcome').toggle();
});

socket.on('roomvisibility', function() {
    $('#rooms').toggle();
    $('#gameinfo').html('');
});

socket.on('gamevisibility', function() {
    $('#game').toggle();
});

socket.on('boardvisibility', function() {
    $('#gameboard').toggle();
});

socket.on('hideboardvisibility', function() {
    $('#gameboard').hide();
});


//Mets à jour le salon de jeu
socket.on('updateroom', function(rooms, current_room, nbusers) {
    $('#roomcards').empty();
    $.each(rooms, function(key, value) {
        if (value != 'Lobby') {
            if (nbusers[key] <= 2) {
                nbjoueurs = nbusers[key];
                nbspec = 0;
            } else {
                nbjoueurs = 2;
                nbspec = nbusers[key] - 2;
            }
            $('#roomcards').append('<a href="#" onclick="selectRoom(\'' + value + '\')"><div class="roomcard"><center>' + value + '</center><h2></h2><table style="width:100%"><tr><td  class="left">Joueurs</td><td>' + nbjoueurs + '</td></tr><tr><td  class="left">Spectateurs</td><td>' + nbspec + '</td> </tr></table></div></a>');
        }
    });



    $('#salon').html(current_room);
});

//Gère la sélection du salon de jeu
function selectRoom(room) {
    socket.emit('selectRoom', room);
}

//Gère lorsqu'un joueur est prêt à jouer
socket.on('newgame', function(username) {
    $('#state').html('Adversaire : <b>' + username + '</b>');
    $('#gamestate').html('<input type="button" onclick="gamerequest()" value="Nouvelle partie" id="gamerequest" />');
    $('#butleft').html('')
    $('#butup').html('')
    $('#butdown').html('')
    $('#butright').html('')
    document.getElementById('boutton').style.marginTop = '200px'
    $('#score1').html('')
    $('#score2').html('')

});
function gamerequest() {
    $('#gamestate').html('En attente de l\'adversaire');
    socket.emit('gamerequested');
}

//Attend que les deux joueurs soient prêts
socket.on('waiting', function() {
    $('#state').html('Attente de l\'adversaire');
    $('#gamestate').html('');
    $('#butleft').html('')
    $('#butup').html('')
    $('#butdown').html('')
    $('#butright').html('')
    document.getElementById('boutton').style.marginTop = '0px'
});

//Gère les spectateurs
socket.on('spectating', function(username1, username2) {
    $('#state').html('Vous observez le match<br/><b>' + username1 + '</b> vs <b>' + username2 + '</b>');
    $('#gamestate').html('Attente du début de la partie');
});

//Gère la mise à jour du plateau de jeu
socket.on('updateboard', function(username, socketid, board, score1, score2, usernameplayer1, usernameplayer2) {

    if (board) {
        $('#gameboard').empty();

        //Si l'id local est l'id du joueur qui doit jouer on lui affiche les boutons
        if (socket.socket.sessionid == socketid) {

            $('#gamestate').html('C\'est votre tour !');
            $('#score1').html('Le score de '+usernameplayer1 + ' est de : ' + score1)
            $('#score2').html('Le score de '+usernameplayer2 + ' est de : ' + score2)
            $('#butleft').html('<input type="button" id="bouttonleft" onclick="movementleft()" value="left" />')
            $('#butup').html('<input type="button" id="bouttonup" onclick="movementup()" value="up" />')
            $('#butdown').html('<input type="button" id="bouttondown" onclick="movementdown()" value="down" />')
            $('#butright').html('<input type="button" id="bouttonright" onclick="movementright()" value="right" />')
            document.getElementById('boutton').style.marginTop = '0px'

        //Sinon les boutons ne sont pas affichés
        } else {
            $('#gamestate').html('Au tour de ' + username);
            $('#score1').html('Le score de '+usernameplayer1 + ' est de : ' + score1)
            $('#score2').html('Le score de '+usernameplayer2 + ' est de : ' + score2)
            $('#butleft').html('')
            $('#butup').html('')
            $('#butdown').html('')
            $('#butright').html('')
            document.getElementById('boutton').style.marginTop = '0px'
        }




        $('#gameboard').append('<div row="0" col="0" ' + '  class="middle" style="' + '">' +board[0][0]+ '</div>');
        $('#gameboard').append('<div row="0" col="1" ' + '  class="middle" style="' + '">' +board[0][1]+'</div>');
        $('#gameboard').append('<div row="0" col="2" ' + '  class="middle" style="' + '">' +board[0][2]+ '</div>');
        $('#gameboard').append('<div row="0" col="3" ' + '  class="middle" style="' + '">' +board[0][3]+ '</div>');
        $('#gameboard').append('<div row="1" col="0" ' + '  class="middle" style="' + '">' +board[1][0]+ '</div>');
        $('#gameboard').append('<div row="1" col="1" ' +  ' class="middle" style="' + '">' +board[1][1]+ '</div>');
        $('#gameboard').append('<div row="1" col="2" ' + '  class="middle" style="' + '">' +board[1][2]+ '</div>');
        $('#gameboard').append('<div row="1" col="3" ' + '  class="middle" style="' + '">' +board[1][3]+ '</div>');
        $('#gameboard').append('<div row="2" col="0" ' + '  class="middle" style="' + '">' +board[2][0]+ '</div>');
        $('#gameboard').append('<div row="2" col="1" ' + '  class="middle" style="' + '">' +board[2][1]+ '</div>');
        $('#gameboard').append('<div row="2" col="2" ' + '  class="middle" style="' + '">' +board[2][2]+ '</div>');
        $('#gameboard').append('<div row="2" col="3" ' + '  class="middle" style="' + '">' +board[2][3]+ '</div>');
        $('#gameboard').append('<div row="3" col="0" ' + '  class="middle" style="' + '">' +board[3][0]+ '</div>');
        $('#gameboard').append('<div row="3" col="1" ' + '  class="middle" style="' + '">' +board[3][1]+ '</div>');
        $('#gameboard').append('<div row="3" col="2" ' + '  class="middle" style="' + '">' +board[3][2]+ '</div>');
        $('#gameboard').append('<div row="3" col="3" ' + '  class="middle" style="' + '">' +board[3][3]+ '</div>');
    }

});


//Le joueur ayant la main déclenche cette fonction en cliquant sur une case, on envoie la case où il a cliqué (stocké dans l'id des div)
function movementleft(){
    socket.emit('processgame', 'left');
}

function movementup(){
    socket.emit('processgame', 'up');
}

function movementdown(){
    socket.emit('processgame', 'down');
}

function movementright(){
    socket.emit('processgame', 'right');
}


//Si le serveur envoie une notif de fin de jeu (déconnexion d'un des joueurs, victoire, match nul) on déclenche cette fonction qui envoie une notif affichant le tableau mais aussi l'état
socket.on('gameended', function(board, matchdetails, conclusion) {

	
    if (board) {} else {
        board = [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ];
    }



    $('#score1').html('')
    $('#score2').html('')
    


    $('#finalgameboard').empty();

    $('#finalgameboard').append('<div row="0" col="0"  class="middle">' +board[0][0]+ '</div>');
    $('#finalgameboard').append('<div row="0" col="1"  class="middle">' +board[0][1]+ '</div>');
    $('#finalgameboard').append('<div row="0" col="2"  class="middle">' +board[0][2]+ '</div>');
    $('#finalgameboard').append('<div row="0" col="3"  class="middle">' +board[0][3]+ '</div>');
    $('#finalgameboard').append('<div row="1" col="0"  class="middle">' +board[1][0]+ '</div>');
    $('#finalgameboard').append('<div row="1" col="1"  class="middle">' +board[1][1]+ '</div>');
    $('#finalgameboard').append('<div row="1" col="2"  class="middle">' +board[1][2]+ '</div>');
    $('#finalgameboard').append('<div row="1" col="3"  class="middle">' +board[1][3]+ '</div>');
    $('#finalgameboard').append('<div row="2" col="0"  class="middle">' +board[2][0]+ '</div>');
    $('#finalgameboard').append('<div row="2" col="1"  class="middle">' +board[2][1]+ '</div>');
    $('#finalgameboard').append('<div row="2" col="2"  class="middle">' +board[2][2]+ '</div>');
    $('#finalgameboard').append('<div row="2" col="3"  class="middle">' +board[2][3]+ '</div>');
    $('#finalgameboard').append('<div row="3" col="0"  class="middle">' +board[3][0]+ '</div>');
    $('#finalgameboard').append('<div row="3" col="1"  class="middle">' +board[3][1]+ '</div>');
    $('#finalgameboard').append('<div row="3" col="2"  class="middle">' +board[3][2]+ '</div>');
    $('#finalgameboard').append('<div row="3" col="3"  class="middle">' +board[3][3]+ '</div>');

    $('#matchdetails').html(matchdetails);
    $('#conclusion').html(conclusion);
    $('#gameended').fadeTo(100, 1);


    //Gère le compteur en fin de partie
    $.fn.countdown = function(callback, duration) {

        var container = $(this[0]).html(duration);

        var countdown = setInterval(function() {

            if (--duration) {

                $('#countdown').html(duration);

            } else {

                clearInterval(countdown);

                callback.call(container);
            }

        }, 1000);

    };

    $("#countdown").countdown(redirect, 5);

    function redirect() {
        $('#countdown').html(0);
        $('#gameended').fadeTo(1000, 0); //On cache la notif
        setTimeout(function() {
            $('#gameended').toggle(); //On la réaffiche
        }, 1003);

    }


});