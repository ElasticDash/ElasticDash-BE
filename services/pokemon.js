import express from 'express';
const router = express.Router();
import { getPokemon, getPokemonDetails, getPokemonMoves } from '../controller/pokemon/pokemon';
import teamController from '../controller/pokemon/team';
import { generalApiResponseSender, generalApiErrorHandler } from '../controller/general/tools';
import { getMove } from '../controller/pokemon/move';
import { getAbility } from '../controller/pokemon/ability';
import { getType } from '../controller/pokemon/type';
import * as auth from '../controller/auth/auth';

/**
 * GET Pokémon by ID or name with pagination
 */
router.post('/search', async (req, res) => {
    console.log('api: POST /pokemon/search');
    try {
        const input = req.body.searchterm;
        const filter = req.body.filter || {};
        const page = parseInt(req.body.page) || 0;
        const sortby = req.body.sortby || 0;
        const result = await getPokemon(input, filter, page, sortby);
        generalApiResponseSender(res, result);
    } catch (error) {
        console.error(error);
        generalApiErrorHandler(res, error);
    }
});

/**
 * GET Move by ID or name with pagination
 */
router.post('/move/search', async (req, res) => {
    console.log('api: POST /pokemon/move/search');
    try {
        const input = req.body.searchterm;
        const page = parseInt(req.body.page) || 0;
        const result = await getMove(input, page);
        generalApiResponseSender(res, result);
    } catch (error) {
        console.error(error);
        generalApiErrorHandler(res, error);
    }
});

/**
 * GET Ability by ID or name with pagination
 */
router.post('/ability/search', async (req, res) => {
    console.log('api: POST /pokemon/ability/search');
    try {
        const input = req.body.searchterm;
        const page = parseInt(req.body.page) || 0;
        const result = await getAbility(input, page);
        generalApiResponseSender(res, result);
    } catch (error) {
        console.error(error);
        generalApiErrorHandler(res, error);
    }
});

/**
 * GET Type by ID or name with pagination
 */
router.post('/type/search', async (req, res) => {
    console.log('api: POST /pokemon/type/search');
    try {
        const input = req.body.searchterm;
        const page = parseInt(req.body.page) || 0;
        const result = await getType(input, page);
        generalApiResponseSender(res, result);
    } catch (error) {
        console.error(error);
        generalApiErrorHandler(res, error);
    }
});

router.get('/details/:id', async (req, res) => {
    console.log('api: GET /pokemon/details/:id');
    try {
        const pokemonId = parseInt(req.params.id, 10);
        if (isNaN(pokemonId)) {
            return res.status(400).json({ error: 'Invalid Pokémon ID' });
        }
        const result = await getPokemonDetails(pokemonId);
        generalApiResponseSender(res, result);
    } catch (error) {
        console.error(error);
        generalApiErrorHandler(res, error);
    }
});

/**
 * POST Pokémon moves with sorting, filtering, and pagination
 */
router.post('/moves', async (req, res) => {
    console.log('api: POST /pokemon/moves');
    try {
        const { pokemonId, typeId, learnMethodId, sortBy, page } = req.body;

        if (!pokemonId || isNaN(pokemonId)) {
            return res.status(400).json({ error: 'Invalid Pokémon ID' });
        }

        const options = {
            typeId: typeId || null,
            learnMethodId: learnMethodId || 1,
            sortBy: sortBy || 0,
            page: page || 0
        };

        const result = await getPokemonMoves(pokemonId, options);
        generalApiResponseSender(res, result);
    } catch (error) {
        console.error(error);
        generalApiErrorHandler(res, error);
    }
});

// Watchlist routes
router.post('/watchlist', async (request, response) => {
    console.log('api: POST /pokemon/watchlist');
    const { pokemonId } = request.body;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const addToWatchlist = teamController.addToWatchlist(myId, pokemonId);
            addToWatchlist.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

router.delete('/watchlist/:pokemonId', async (request, response) => {
    console.log('api: DELETE /pokemon/watchlist/:pokemonId');
    const itemId = request.params.pokemonId;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const removeFromWatchlist = teamController.removeFromWatchlist(myId, itemId);
            removeFromWatchlist.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

router.delete('/allwatchlist', async (request, response) => {
    console.log('api: DELETE /pokemon/allwatchlist');
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const removeAllFromWatchlist = teamController.removeAllFromWatchlist(myId);
            removeAllFromWatchlist.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

router.get('/watchlist', async (request, response) => {
    console.log('api: GET /pokemon/watchlist');
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const getWatchlist = teamController.getWatchlist(myId);
            getWatchlist.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// Team routes
router.post('/teams', async (request, response) => {
    console.log('api: POST /pokemon/teams');
    const { teamName } = request.body;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const createTeam = teamController.createTeam(myId, teamName);
            createTeam.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

router.delete('/teams/:teamId', async (request, response) => {
    console.log('api: DELETE /pokemon/teams/:teamId');
    const { teamId } = request.params;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const deleteTeam = teamController.deleteTeam(teamId);
            deleteTeam.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

router.delete('/allteams', async (request, response) => {
    console.log('api: DELETE /pokemon/allteams');
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const deleteAllTeams = teamController.deleteAllTeams(myId);
            deleteAllTeams.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

router.get('/teams', async (request, response) => {
    console.log('api: GET /pokemon/teams');
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const getTeams = teamController.getTeams(myId);
            getTeams.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });

});

// Team members routes
router.post('/teams/:teamId/members', async (request, response) => {
    console.log('api: POST /pokemon/teams/:teamId/members');
    const { teamId } = request.params;
    const { pokemonId, nickname, level, moves, shiny, orderIndex } = request.body;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const addTeamMember = teamController.addTeamMember(teamId, pokemonId, nickname, level, moves, shiny, orderIndex);
            addTeamMember.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

router.delete('/teams/members/:memberId', async (request, response) => {
    console.log('api: DELETE /pokemon/teams/members/:memberId');
    const { memberId } = request.params;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const removeTeamMember = teamController.removeTeamMember(memberId);
            removeTeamMember.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

router.get('/teams/:teamId/members', async (request, response) => {
    console.log('api: GET /pokemon/teams/:teamId/members');
    const { teamId } = request.params;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const getTeamMembers = teamController.getTeamMembers(teamId);
            getTeamMembers.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

export { router as pokemon };