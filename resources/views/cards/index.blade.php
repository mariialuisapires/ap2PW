@extends('layouts.app')

@section('content')
<div class="d-flex justify-content-between mb-3">
    <h2>Card List</h2>
    <a class="btn btn-primary" href="{{ route('cards.create') }}">Create Card</a>
</div>

@if (session('success'))
    <div class="alert alert-success">{{ session('success') }}</div>
@endif

<table class="table table-bordered">
    <tr>
        <th>ID</th>
        <th>Title</th>
        <th>Description</th>
        <th>Image</th>
        <th>Action</th>
    </tr>
    @foreach ($cards as $card)
    <tr>
        <td>{{ $card->id }}</td>
        <td>{{ $card->title }}</td>
        <td>{{ $card->description }}</td>
        <td> @if($card->image)
                <img src="{{ asset('storage/' . $card->image) }}" alt="{{ $card->title }}" width="100">
            @endif
        </td>
        <td>
            <a class="btn btn-info btn-sm" href="{{ route('cards.show', $card) }}">Show</a>
            <a class="btn btn-warning btn-sm" href="{{ route('cards.edit', $card) }}">Edit</a>
            <form action="{{ route('cards.destroy', $card) }}" method="POST" class="d-inline">
                @csrf @method('DELETE')
                <button type="submit" class="btn btn-danger btn-sm">Delete</button>
            </form>
        </td>
    </tr>
    @endforeach
</table>

{{ $cards->links() }}
@endsection