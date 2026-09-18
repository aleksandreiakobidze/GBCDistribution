<?php

namespace App\Filament\Resources;

use App\Enums\UserRole;
use App\Filament\Resources\CustomerResource\Pages;
use App\Models\Customer;
use App\Models\User;
use Filament\Schemas\Components\Section;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;
use Filament\Resources\Resource;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;

class CustomerResource extends Resource
{
    protected static ?string $model = Customer::class;

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-building-storefront';

    protected static string | \UnitEnum | null $navigationGroup = 'Sales';

    public static function canCreate(): bool
    {
        return config('erp.provider') === 'fake';
    }

    public static function canEdit(\Illuminate\Database\Eloquent\Model $record): bool
    {
        return config('erp.provider') === 'fake';
    }

    public static function form(Schema $form): Schema
    {
        return $form
            ->schema([
                Section::make('General')
                    ->schema([
                        TextInput::make('name')
                            ->required()
                            ->maxLength(255),
                        TextInput::make('contact_person')
                            ->maxLength(255),
                        TextInput::make('phone')
                            ->tel()
                            ->maxLength(255),
                        TextInput::make('email')
                            ->email()
                            ->maxLength(255),
                        Textarea::make('address')
                            ->rows(3),
                        TextInput::make('city')
                            ->maxLength(255),
                    ])
                    ->columns(2),

                Section::make('Settings')
                    ->schema([
                        Select::make('category')
                            ->options([
                                'A' => 'A - Premium',
                                'B' => 'B - Standard',
                                'C' => 'C - Basic',
                            ]),
                        TextInput::make('credit_limit')
                            ->numeric()
                            ->prefix('₾'),
                        Select::make('assigned_sales_rep_id')
                            ->label('Assigned Sales Rep')
                            ->options(
                                User::where('role', UserRole::SalesRep)->pluck('name', 'id')
                            )
                            ->searchable(),
                        TextInput::make('latitude')
                            ->numeric(),
                        TextInput::make('longitude')
                            ->numeric(),
                        Toggle::make('is_active')
                            ->default(true),
                    ])
                    ->columns(2),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('id')
                    ->sortable(),
                TextColumn::make('name')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('contact_person')
                    ->searchable(),
                TextColumn::make('phone')
                    ->searchable(),
                TextColumn::make('city')
                    ->sortable(),
                TextColumn::make('category')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'A' => 'success',
                        'B' => 'warning',
                        'C' => 'danger',
                        default => 'gray',
                    }),
                TextColumn::make('credit_limit')
                    ->numeric(decimalPlaces: 2)
                    ->prefix('₾')
                    ->sortable(),
                TextColumn::make('outstanding_balance')
                    ->numeric(decimalPlaces: 2)
                    ->prefix('₾')
                    ->sortable(),
                IconColumn::make('is_active')
                    ->boolean(),
                TextColumn::make('assignedSalesRep.name')
                    ->label('Sales Rep'),
            ])
            ->filters([
                SelectFilter::make('category')
                    ->options([
                        'A' => 'A - Premium',
                        'B' => 'B - Standard',
                        'C' => 'C - Basic',
                    ]),
                SelectFilter::make('city')
                    ->options(fn () => Customer::distinct()->whereNotNull('city')->pluck('city', 'city')->toArray()),
                TernaryFilter::make('is_active'),
                SelectFilter::make('assigned_sales_rep_id')
                    ->label('Sales Rep')
                    ->options(User::where('role', UserRole::SalesRep)->pluck('name', 'id')),
            ])
            ->defaultSort('id', 'desc');
    }

    public static function getRelations(): array
    {
        return [];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListCustomers::route('/'),
            'create' => Pages\CreateCustomer::route('/create'),
            'edit' => Pages\EditCustomer::route('/{record}/edit'),
        ];
    }
}
