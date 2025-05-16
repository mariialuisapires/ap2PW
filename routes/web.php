<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\CardController; 

Route::get('/', function () {
    return view('welcome');
});

Route::resource('cards', controller: CardController::class);

 