<?php

namespace App\Filament\Resources;

use App\Enums\PaymentStatus;
use App\Filament\Resources\InvoiceResource\Pages;
use App\Models\Invoice;
use Filament\Infolists\Components\RepeatableEntry;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class InvoiceResource extends Resource
{
    protected static ?string $model = Invoice::class;

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-document-text';

    protected static string | \UnitEnum | null $navigationGroup = 'Finance';

    public static function canCreate(): bool
    {
        return false;
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('invoice_number')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('customer.name')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('amount')
                    ->numeric(decimalPlaces: 2)
                    ->prefix('₾')
                    ->sortable(),
                TextColumn::make('paid_amount')
                    ->numeric(decimalPlaces: 2)
                    ->prefix('₾')
                    ->sortable(),
                TextColumn::make('status')
                    ->badge()
                    ->color(fn (PaymentStatus $state): string => match ($state) {
                        PaymentStatus::Draft => 'gray',
                        PaymentStatus::Sent => 'info',
                        PaymentStatus::Paid => 'success',
                        PaymentStatus::Partial => 'warning',
                        PaymentStatus::Overdue => 'danger',
                    }),
                TextColumn::make('due_date')
                    ->date()
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->options(PaymentStatus::class),
            ])
            ->defaultSort('id', 'desc');
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema
            ->schema([
                Section::make('Invoice Details')
                    ->schema([
                        TextEntry::make('invoice_number'),
                        TextEntry::make('customer.name'),
                        TextEntry::make('order.order_number'),
                        TextEntry::make('amount')
                            ->prefix('₾'),
                        TextEntry::make('paid_amount')
                            ->prefix('₾'),
                        TextEntry::make('status')
                            ->badge(),
                        TextEntry::make('due_date')
                            ->date(),
                    ])
                    ->columns(2),

                Section::make('Payments')
                    ->schema([
                        RepeatableEntry::make('payments')
                            ->schema([
                                TextEntry::make('amount')
                                    ->prefix('₾'),
                                TextEntry::make('method')
                                    ->badge(),
                                TextEntry::make('paid_at')
                                    ->dateTime(),
                                TextEntry::make('reference'),
                                TextEntry::make('receivedBy.name')
                                    ->label('Received By'),
                            ])
                            ->columns(5),
                    ]),
            ]);
    }

    public static function getRelations(): array
    {
        return [];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListInvoices::route('/'),
            'view' => Pages\ViewInvoice::route('/{record}'),
        ];
    }
}
