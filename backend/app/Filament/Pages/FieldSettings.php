<?php

namespace App\Filament\Pages;

use App\Enums\UserRole;
use App\Models\FieldSetting;
use Filament\Actions\Action;
use Filament\Forms\Components\Toggle;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Schemas\Components\Actions;
use Filament\Schemas\Components\EmbeddedSchema;
use Filament\Schemas\Components\Form;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use BackedEnum;
use UnitEnum;

class FieldSettings extends Page
{
    protected static string|BackedEnum|null $navigationIcon = 'heroicon-o-cog-6-tooth';

    protected static string|UnitEnum|null $navigationGroup = 'System';

    protected static ?string $navigationLabel = 'Settings';

    protected static ?string $title = 'საველე პარამეტრები';

    protected static ?string $slug = 'field-settings';

    /**
     * @var array<string, mixed>|null
     */
    public ?array $data = [];

    public static function canAccess(): bool
    {
        $user = auth()->user();

        return $user !== null && $user->role === UserRole::Admin;
    }

    public function mount(): void
    {
        $this->getSchema('form')->fill(
            FieldSetting::current()->only([
                'require_photo_before',
                'require_photo_end',
                'require_photo_shelf',
                'require_survey',
                'require_shelf_audit',
                'require_gps',
                'missed_skips_rules',
            ]),
        );
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('ვიზიტის წესები')
                    ->description('ჩართული წესის გარეშე პრისელერი ვიზიტს ვერ ხურავს. „ვერ შევედი“ ამ წესებს არ ექვემდებარება, სანამ ეს ჩართულია.')
                    ->schema([
                        Toggle::make('require_photo_before')
                            ->label('ვიზიტამდე ფოტო აუცილებელია'),
                        Toggle::make('require_photo_end')
                            ->label('დასრულების ფოტო აუცილებელია')
                            ->helperText('მოქმედებს, როცა პრისელერი აღნიშნავს, რომ შევიდა.'),
                        Toggle::make('require_photo_shelf')
                            ->label('თაროს ფოტო აუცილებელია'),
                        Toggle::make('require_survey')
                            ->label('გამოკითხვა აუცილებელია'),
                        Toggle::make('require_shelf_audit')
                            ->label('თაროს აუდიტი აუცილებელია'),
                        Toggle::make('require_gps')
                            ->label('GPS აუცილებელია')
                            ->helperText('ვიზიტის დაწყებასა და დასრულებაზე.'),
                        Toggle::make('missed_skips_rules')
                            ->label('„ვერ შევედი“ წესებს არ ექვემდებარება')
                            ->default(true),
                    ]),
            ])
            ->statePath('data');
    }

    public function content(Schema $schema): Schema
    {
        return $schema->components([
            Form::make([EmbeddedSchema::make('form')])
                ->id('form')
                ->livewireSubmitHandler('save')
                ->footer([
                    Actions::make([
                        Action::make('save')
                            ->label('შენახვა')
                            ->submit('save'),
                    ]),
                ]),
        ]);
    }

    public function save(): void
    {
        $data = $this->getSchema('form')->getState();
        FieldSetting::current()->update($data);

        Notification::make()
            ->title('შენახულია')
            ->success()
            ->send();
    }
}
