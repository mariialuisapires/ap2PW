<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\CardController;
use App\Http\Controllers\GameController;


Route::get('/', function () {
    return view('welcome');
});

Route::resource('cards', controller: CardController::class);
Route::get('/jogo',[GameController::class,'jogo']);

 