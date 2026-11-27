import { useState } from 'react';
import { ChevronDown, Plus, Trash2, Upload } from 'lucide-react';
import {
  discountMax,
  discountedPrice,
  emptyProduct,
  featuresLimit,
  productCategories,
  productLimit,
  stockMax,
  type CmsFile,
  type CmsProduct,
  type CmsReview,
} from '../../shared/site-content';
import { Field, Panel } from './PortalUI';
import { FilePicker } from './FilePicker';

// The shop sections live here: products (with photos) and the local reviews.
export function ProductsPanel({
  products,
  library,
  busy,
  onChange,
  onUpload,
}: {
  products: CmsProduct[];
  library: CmsFile[];
  busy: boolean;
  onChange: (products: CmsProduct[]) => void;
  onUpload: (index: number, file: File) => void;
}) {
  const [filter, setFilter] = useState(''),
    [query, setQuery] = useState(''),
    [open, setOpen] = useState<number | null>(products.length === 1 ? 0 : null);
  const visible = products
    .map((product, index) => ({ product, index }))
    .filter(
      ({ product }) =>
        (!filter || product.category === filter) &&
        (!query ||
          `${product.name} ${product.category} ${product.subcategory}`
            .toLowerCase()
            .includes(query.trim().toLowerCase())),
    );
  const update = (index: number, patch: Partial<CmsProduct>) =>
    onChange(
      products.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  const categories = [
    ...new Set([
      ...productCategories,
      ...products.map((product) => product.category).filter(Boolean),
    ]),
  ];
  return (
    <Panel
      title="Produse"
      description="Fiecare produs are nume, descriere, preț, poză și, opțional, un discount. Site-ul calculează prețul redus și taie prețul vechi; discountul de aici nu modifică prețul de bază. Produsele ascunse rămân salvate, dar nu apar pe site."
    >
      <div className="section-heading cms-products-toolbar">
        <Field label="Filtrează după categorie">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Toate categoriile</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Caută produs">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nume, categorie…"
          />
        </Field>
        <button
          type="button"
          className="button primary"
          disabled={products.length >= productLimit}
          onClick={() => {
            onChange([...products, emptyProduct()]);
            setOpen(products.length);
          }}
        >
          <Plus size={16} /> Produs nou
        </button>
      </div>

      {!products.length && (
        <p className="cms-note">
          Nu există încă produse. Apasă „Produs nou” sau „Importă de pe site” ca
          să le preia din magazinul existent.
        </p>
      )}

      <ul className="cms-product-list" aria-label="Produse">
        {visible.map(({ product, index }) => {
          const reduced = discountedPrice(product.price, product.discount);
          return (
            <li
              key={index}
              className={`cms-product-item${product.active ? '' : ' is-hidden'}`}
            >
              <div className="cms-product-head">
                <span className="cms-product-thumb">
                  {product.image || product.imageUrl ? (
                    <img
                      src={product.image?.url || product.imageUrl}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <Upload size={16} />
                  )}
                </span>
                <span className="cms-product-title">
                  <strong>{product.name || `Produs ${index + 1}`}</strong>
                  <small className="muted">
                    {[product.category, product.subcategory]
                      .filter(Boolean)
                      .join(' · ') || 'Fără categorie'}
                    {product.stock !== null &&
                      ` · ${product.stock} ${product.unit || 'buc.'}`}
                  </small>
                </span>
                <span className="cms-product-flags">
                  {product.bestseller && <em className="badge">Bestseller</em>}
                  {product.badge &&
                    product.badge.toLowerCase() !== 'bestseller' && (
                      <em className="badge badge-quiet">{product.badge}</em>
                    )}
                  <span className="cms-product-price">
                    <b>{reduced?.price ?? (product.price || '—')}</b>
                    {reduced && <s>{reduced.compare}</s>}
                    {product.discount > 0 && <em>−{product.discount}%</em>}
                  </span>
                </span>
                <span className="cms-product-actions">
                  <button
                    type="button"
                    className="button secondary small"
                    aria-pressed={!product.active}
                    onClick={() => update(index, { active: !product.active })}
                  >
                    {product.active ? 'Ascunde' : 'Publică'}
                  </button>
                  <button
                    type="button"
                    className="button secondary small"
                    aria-expanded={open === index}
                    onClick={() => setOpen(open === index ? null : index)}
                  >
                    Editează <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    className="button danger small"
                    aria-label={`Șterge: ${
                      product.name || `produsul ${index + 1}`
                    }`}
                    onClick={() =>
                      onChange(products.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </span>
              </div>

              {open === index && (
                <div className="cms-product-form">
                  <div className="cms-product-body">
                    <div className="cms-product-image">
                      {product.image || product.imageUrl ? (
                        <img
                          src={product.image?.url || product.imageUrl}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <span className="cms-note">Fără poză</span>
                      )}
                      <FilePicker
                        label="Încarcă poză"
                        inputLabel={`Încarcă poza produsului ${index + 1}`}
                        accept="image/jpeg,image/png,image/webp"
                        disabled={busy}
                        onFiles={(files) => {
                          const file = files[0];
                          if (file) onUpload(index, file);
                        }}
                      />
                      <span className="cms-note">JPG, PNG sau WebP, max. 5 MB. Poza se micșorează automat.</span>
                      {!!library.length && (
                        <select
                          aria-label={`Alege poza din bibliotecă: produsul ${
                            index + 1
                          }`}
                          value=""
                          onChange={(e) => {
                            const file = library.find(
                              (candidate) => candidate.id === e.target.value,
                            );
                            if (file)
                              update(index, { image: file, imageUrl: '' });
                          }}
                        >
                          <option value="">Din bibliotecă…</option>
                          {library.map((file) => (
                            <option key={file.id} value={file.id}>
                              {file.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {(product.image || product.imageUrl) && (
                        <button
                          type="button"
                          className="button danger small"
                          onClick={() =>
                            update(index, { image: null, imageUrl: '' })
                          }
                        >
                          Șterge poza
                        </button>
                      )}
                    </div>
                    <div className="stack">
                      <div className="form-grid three">
                        <Field label={`Nume produs ${index + 1}`}>
                          <input
                            maxLength={160}
                            value={product.name}
                            onChange={(e) =>
                              update(index, { name: e.target.value })
                            }
                          />
                        </Field>
                        <Field label={`Categorie ${index + 1}`}>
                          <select
                            value={product.category}
                            onChange={(e) =>
                              update(index, { category: e.target.value })
                            }
                          >
                            <option value="">Fără categorie</option>
                            {categories.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label={`Subcategorie ${index + 1}`}>
                          <input
                            maxLength={80}
                            value={product.subcategory}
                            onChange={(e) =>
                              update(index, { subcategory: e.target.value })
                            }
                          />
                        </Field>
                      </div>
                      <div className="form-grid three">
                        <Field label={`Preț întreg ${index + 1}`}>
                          <input
                            maxLength={40}
                            value={product.price}
                            placeholder="69"
                            onChange={(e) =>
                              update(index, { price: e.target.value })
                            }
                          />
                        </Field>
                        <Field label={`Stoc ${index + 1}`}>
                          <input
                            type="number"
                            min={0}
                            max={stockMax}
                            step={1}
                            value={product.stock ?? ''}
                            placeholder="—"
                            onChange={(e) =>
                              update(index, {
                                stock:
                                  e.target.value === ''
                                    ? null
                                    : Math.min(
                                        stockMax,
                                        Math.max(
                                          0,
                                          Math.round(Number(e.target.value)),
                                        ),
                                      ),
                              })
                            }
                          />
                        </Field>
                        <Field label={`Unitate / ambalaj ${index + 1}`}>
                          <input
                            maxLength={40}
                            value={product.unit}
                            placeholder="1 kg, 5 l, buc."
                            onChange={(e) =>
                              update(index, { unit: e.target.value })
                            }
                          />
                        </Field>
                      </div>
                      <div className="form-grid three">
                        <Field label={`Etichetă (badge) ${index + 1}`}>
                          <input
                            maxLength={40}
                            value={product.badge}
                            placeholder="Nou, Promo…"
                            onChange={(e) =>
                              update(index, { badge: e.target.value })
                            }
                          />
                        </Field>
                        <Field label={`Sezon ${index + 1}`}>
                          <input
                            maxLength={40}
                            value={product.season}
                            placeholder="Primăvară–Toamnă"
                            onChange={(e) =>
                              update(index, { season: e.target.value })
                            }
                          />
                        </Field>
                        <Field
                          label={`Discount ${index + 1} (%)`}
                          hint="0 = fără reducere, maximum 90"
                        >
                          <input
                            type="number"
                            min={0}
                            max={discountMax}
                            step={1}
                            value={product.discount}
                            onChange={(e) => {
                              const value = Math.round(Number(e.target.value));
                              update(index, {
                                discount: Number.isFinite(value)
                                  ? Math.min(
                                      discountMax,
                                      Math.max(0, value),
                                    )
                                  : 0,
                              });
                            }}
                          />
                        </Field>
                      </div>
                      <Field label={`Descriere produs ${index + 1}`}>
                        <textarea
                          rows={3}
                          maxLength={2000}
                          value={product.description}
                          onChange={(e) =>
                            update(index, { description: e.target.value })
                          }
                        />
                      </Field>
                      <Field
                        label={`Caracteristici ${index + 1} (separate cu |)`}
                      >
                        <input
                          value={product.features.join(' | ')}
                          placeholder="Rezistent la secetă | Creștere rapidă"
                          onChange={(e) =>
                            update(index, {
                              features: e.target.value
                                .split('|')
                                .map((feature) => feature.trim())
                                .filter(Boolean)
                                .slice(0, featuresLimit),
                            })
                          }
                        />
                      </Field>
                      <div className="cms-product-deal">
                        <label className="cms-check">
                          <input
                            type="checkbox"
                            checked={product.bestseller}
                            onChange={(e) =>
                              update(index, { bestseller: e.target.checked })
                            }
                          />
                          <span>Bestseller</span>
                        </label>
                        <label className="cms-check">
                          <input
                            type="checkbox"
                            checked={product.active}
                            onChange={(e) =>
                              update(index, { active: e.target.checked })
                            }
                          />
                          <span>Vizibil pe site</span>
                        </label>
                        <p className="cms-note cms-product-price">
                          {product.discount > 0
                            ? reduced
                              ? `Se afișează ${reduced.price}, cu ${product.price}${
                                  /[a-z]/i.test(product.price) ? '' : ' lei'
                                } tăiat.`
                              : 'Discountul se aplică doar dacă prețul întreg este un număr, de exemplu 69 sau 69,00.'
                            : 'Fără discount: se afișează doar prețul întreg.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!!products.length && !visible.length && (
        <p className="cms-note">Niciun produs nu corespunde filtrului.</p>
      )}
    </Panel>
  );
}

export function ReviewsPanel({
  reviews,
  onChange,
}: {
  reviews: CmsReview[];
  onChange: (reviews: CmsReview[]) => void;
}) {
  return (
    <Panel
      title="Recenzii"
      description="Recenziile locale apar pe site. Recenziile Google se încarcă automat și nu se editează aici. O recenzie ștearsă dispare de pe site la următoarea publicare."
    >
      {!reviews.length && (
        <p className="cms-note">
          Nu există recenzii locale. „Importă de pe site” le preia dacă sunt în
          marcajul paginii.
        </p>
      )}
      <ul className="cms-review-list">
        {reviews.map((review, index) => (
          <li key={index} className="cms-review">
            <div className="stack">
              <strong>
                {review.name || `Recenzie ${index + 1}`}{' '}
                <span aria-label={`${review.rating} din 5`}>
                  {'★'.repeat(review.rating)}
                  {'☆'.repeat(5 - review.rating)}
                </span>
              </strong>
              <small className="muted">
                {[review.location, review.date].filter(Boolean).join(' · ')}
              </small>
              <p>{review.text}</p>
            </div>
            <button
              type="button"
              className="button danger small"
              aria-label={`Șterge recenzia: ${review.name || index + 1}`}
              onClick={() => onChange(reviews.filter((_, i) => i !== index))}
            >
              <Trash2 size={15} /> Șterge
            </button>
          </li>
        ))}
      </ul>
      <p className="cms-note">
        Recenziile noi se adaugă doar pe site sau prin import; aici le poți
        șterge pe cele care nu mai trebuie afișate.
      </p>
    </Panel>
  );
}
