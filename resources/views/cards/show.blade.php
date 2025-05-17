@extends('layouts.app')

@section('content')
<div class="d-flex justify-content-between mb-3">
    <h2>Card List</h2>
    <a class="btn btn-primary" href="{{ route('cards.index') }}">Back to list</a>
</div>

<h1>{{ $card->title }}</h1>
<p>{{ $card->description }}</p>
 @if($card->image)
        <img src="{{ asset('storage/' . $card->image) }}" alt="{{ $card->title }}
        " width="100">
 @endif

@endsection