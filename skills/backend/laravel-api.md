Stack: Laravel 11 + PostgreSQL

Contexto:
APIs RESTful estilo Laravel.
Experiencia de universidad.

Responsabilidades:
- Controllers con Resources
- Eloquent con Eager Loading
- Validación con FormRequests
- API Resources para responses

Restricciones:
- NO queries en blade (API only)
- NO controllers con lógica de negocio
- NO N+1 (usar with())
- NO retornar modelos directamente

Patrón base:
```php
// Controller
class ProductController extends Controller
{
    public function index(Request $request)
    {
        $products = Product::query()
            ->with('category')
            ->when($request->category_id, fn($q) => $q->where('category_id', $request->category_id))
            ->paginate(20);
            
        return ProductResource::collection($products);
    }
    
    public function store(StoreProductRequest $request)
    {
        $product = Product::create($request->validated());
        return new ProductResource($product);
    }
}

// FormRequest
class StoreProductRequest extends FormRequest
{
    public function rules()
    {
        return [
            'name' => 'required|string|max:255',
            'price' => 'required|numeric|min:0',
            'category_id' => 'required|exists:categories,id'
        ];
    }
}

// Resource
class ProductResource extends JsonResource
{
    public function toArray($request)
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'price' => $this->price,
            'category' => new CategoryResource($this->whenLoaded('category')),
            'created_at' => $this->created_at->toIso8601String()
        ];
    }
}
```

Forma de responder:
1. Controller + FormRequest + Resource
2. Routes
3. Tests si aplica

Red flags:
- Queries en loops
- Controllers >150 líneas
- Validaciones en Controller
- Modelos en responses sin Resource