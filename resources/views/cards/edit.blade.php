@extends('layouts.app')

@section('content')
<h2>Edit Card</h2>
<form action="{{ route('cards.update', $card) }}" method="POST">
    @csrf @method('PUT')
    <div class="mb-3">
        <label>Title</label>
        <input type="text" id="title" name="title" value="{{ $card->title }}" class="form-control" required>
    </div>
    <div class="mb-3">
        <label>Description</label>
    <textarea id="description "name="description" class="form-control" required>{{ $card->description }}</textarea>
    </div>

    <div class="mb-3">
        <label for="image">Image</label>
        <input type="file" id="image" name="image" class="form-control">
        @if($card->image)
            <img src="{{ asset('storage/' . $card->image) }}" alt="{{ $card->title }}" width="100">
        @endif
    </div>
    <button type="submit" class="btn btn-primary">Update</button>
</form>
@endsection