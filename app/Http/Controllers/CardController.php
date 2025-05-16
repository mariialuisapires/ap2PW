<?php

namespace App\Http\Controllers;

use App\Models\Card;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CardController extends Controller
{
    public function index()
    {
        $cards = Card::latest()->paginate(5);
        return view('cards.index', compact('cards'));
    }

    public function create()
    {
        return view('cards.create');
    }
    
    //DRY

    public function validateRequest(Request $request, bool $imageRequired = false){
         

        
        $rules = [
            'title' => 'required',
            'description' => 'required',
        ];

        $request->validate($rules);

        if($imageRequired){
            $rules['image'] = 'required';
        }
    }

    public function store(Request $request)
    {
        $this->validateRequest($request, true);

        $model = new Card();
        $model->title = $request->title;
        $model->description = $request->description;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('cards', 'public');
            $model->image = $imagePath;
        }
       
       

        $model->save();

        return redirect()->route('cards.index')->with('success', 'Card created successfully.');
    }

    public function show(Card $card)
    {
        return view('cards.show', compact('card'));
    }

    public function edit(Card $card)
    {
        return view('cards.edit', compact('card'));
    }

    public function update(Request $request, Card $card)
    {
        $this->validateRequest(request: $request);

        $card->title = $request->title;
        $card->description = $request->description;
    
        if ($request->hasFile('image')) {
            if ($card->image) {
                Storage::delete('public/' . $card->image);
            }
            $imagePath = $request->file('image')->store('cards', 'public');
            $card->image = $imagePath;
        }
        $card->save();

        return redirect()->route('cards.index')->with('success', 'Card updated successfully.');
    }

    public function destroy(Card $card)
    {
        $card->delete();
        return redirect()->route('cards.index')->with('success', 'Card deleted successfully.');
    }

}
