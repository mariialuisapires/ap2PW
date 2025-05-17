<?php
namespace App\Http\Controllers;
use App\Models\Card;

use Illuminate\Http\Request;

class GameController extends Controller
{
    public function jogo()
    {
        $cards = Card::all();

        return view('game.index', compact('cards'));
    }
}
